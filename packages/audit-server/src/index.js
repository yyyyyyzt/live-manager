/**
 * @live/audit-server
 *
 * 评论先审后发服务：
 *   - 观众端通过 `POST /api/v1/rooms/:roomId/comments` 或契约路径
 *     `POST /api/moderation/comments` 上报待审。
 *   - 管理端拉取 pending / 已发布，approve 后可（可选）调用管理端服务的
 *     `trtc_proxy` 接口把评论作为群组消息推送到房间（send_group_msg）。
 *
 * 关键环境变量：
 *   - AUDIT_PORT                默认 3080
 *   - AUDIT_ADMIN_TOKEN         默认 dev-admin-token；管理接口头 X-Admin-Token
 *   - MANAGER_API_BASE          默认 http://127.0.0.1:9000/api
 *   - PUSH_APPROVED_TO_ROOM     "1" / "true" 时 approve 后向房间下发 IM 群消息
 *   - PUSH_ADMIN_SDK_APP_ID / PUSH_ADMIN_USER_ID / PUSH_ADMIN_USER_SIG
 *     上述 3 个变量均为空时，approve 接口不会代发群消息（避免误触发）。
 */
import express from 'express';
import cors from 'cors';
import * as store from './store.js';

const PORT = Number(process.env.AUDIT_PORT || 3080);
const ADMIN_TOKEN = process.env.AUDIT_ADMIN_TOKEN || 'dev-admin-token';
const MANAGER_API_BASE = (process.env.MANAGER_API_BASE || 'http://127.0.0.1:9000/api').replace(/\/$/, '');
const PUSH_APPROVED_TO_ROOM = /^(1|true|yes)$/i.test(String(process.env.PUSH_APPROVED_TO_ROOM || ''));
const PUSH_ADMIN_SDK_APP_ID = process.env.PUSH_ADMIN_SDK_APP_ID || '';
const PUSH_ADMIN_USER_ID = process.env.PUSH_ADMIN_USER_ID || '';
const PUSH_ADMIN_USER_SIG = process.env.PUSH_ADMIN_USER_SIG || '';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'audit-server' });
});

function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'];
  if (t !== ADMIN_TOKEN) {
    return res.status(401).json({ code: 401, message: 'unauthorized' });
  }
  next();
}

/** 将 store 记录包装成契约响应格式 */
function contractView(rec) {
  if (!rec) return null;
  return {
    id: rec.id,
    roomId: rec.roomId,
    senderId: rec.senderId || rec.author,
    author: rec.author,
    text: rec.text,
    status: rec.status,
    clientMsgId: rec.clientMsgId,
    messageId: rec.messageId,
    createdAt: rec.createdAt,
    approvedAt: rec.approvedAt,
    rejectedAt: rec.rejectedAt,
  };
}

/**
 * 将已通过评论作为群组自定义消息送入房间（可选）。
 * 走管理端 server 的 /api/trtc_proxy，具体 API 路径：v4/group_open_http_svc/send_group_msg。
 * 注意：如果调用链未配置管理端凭证，这里会静默失败，以免阻塞审核主流程。
 */
async function pushApprovedToRoom(rec) {
  if (!PUSH_APPROVED_TO_ROOM) return { skipped: 'flag_off' };
  if (!PUSH_ADMIN_SDK_APP_ID || !PUSH_ADMIN_USER_ID || !PUSH_ADMIN_USER_SIG) {
    return { skipped: 'missing_admin_credentials' };
  }
  const url = `${MANAGER_API_BASE}/trtc_proxy`;
  // 以管理员账号代发，避免观众账号未在 IM 侧注册导致 10004 错误；
  // 原始发送者信息放入 CloudCustomData，前端可据此渲染为观众评论气泡。
  const body = {
    apiPath: 'v4/group_open_http_svc/send_group_msg',
    body: {
      GroupId: rec.roomId,
      From_Account: String(PUSH_ADMIN_USER_ID),
      Random: Math.floor(Math.random() * 1_000_000_000),
      MsgBody: [
        {
          MsgType: 'TIMTextElem',
          MsgContent: { Text: rec.text },
        },
      ],
      CloudCustomData: JSON.stringify({
        type: 'moderation_approved',
        commentId: rec.id,
        senderId: rec.senderId || rec.author || '',
        author: rec.author || '',
      }),
    },
  };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sdk-app-id': String(PUSH_ADMIN_SDK_APP_ID),
        'x-user-id': String(PUSH_ADMIN_USER_ID),
        'x-user-sig': String(PUSH_ADMIN_USER_SIG),
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({}));
    if (json?.ErrorCode && json.ErrorCode !== 0) {
      console.warn('[audit-server] push to room failed:', json);
      return { ok: false, error: json.ErrorInfo || 'push_failed', detail: json };
    }
    return { ok: true, detail: json };
  } catch (e) {
    console.warn('[audit-server] push to room exception:', e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}

// ========== 当前仓库路由（/api/v1/...） ==========

/** 观众投稿 */
app.post('/api/v1/rooms/:roomId/comments', (req, res) => {
  const { roomId } = req.params;
  const { author, senderId, text, clientMsgId, messageId, timestamp } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ code: 400, message: 'text required' });
  }
  const rec = store.enqueue({ roomId, author, senderId, text, clientMsgId, messageId, timestamp });
  res.status(201).json({ code: 0, data: contractView(rec), duplicate: !!rec.duplicate });
});

/** 管理端拉取待审 */
app.get('/api/v1/rooms/:roomId/comments/pending', requireAdmin, (req, res) => {
  const { roomId } = req.params;
  res.json({ code: 0, data: store.listPending(roomId).map(contractView) });
});

/** 观众/管理端拉取已通过 */
app.get('/api/v1/rooms/:roomId/comments/published', (req, res) => {
  const { roomId } = req.params;
  const since = Number(req.query.since || 0);
  const limit = Number(req.query.limit || 100);
  const list = store.listPublished({ roomId, since, limit }).map(contractView);
  res.json({ code: 0, data: { list, serverTime: Date.now() } });
});

app.post('/api/v1/comments/:id/approve', requireAdmin, async (req, res) => {
  const r = store.setStatus(req.params.id, 'approved');
  if (!r) return res.status(404).json({ code: 404, message: 'not found' });
  const push = await pushApprovedToRoom(r);
  res.json({ code: 0, data: contractView(r), push });
});

app.post('/api/v1/comments/:id/reject', requireAdmin, (req, res) => {
  const r = store.setStatus(req.params.id, 'rejected');
  if (!r) return res.status(404).json({ code: 404, message: 'not found' });
  res.json({ code: 0, data: contractView(r), ok: true });
});

// ========== 契约路由（/api/moderation/...） ==========
// 与 docs/AUDIENCE_MODERATION_CONTRACT.md 对齐。

app.post('/api/moderation/comments', (req, res) => {
  const { roomId, senderId, text, clientMsgId, messageId, timestamp } = req.body || {};
  if (!roomId) return res.json({ code: -1, message: 'roomId required' });
  if (!senderId) return res.json({ code: -1, message: 'senderId required' });
  if (!text || !String(text).trim()) return res.json({ code: -1, message: 'text required' });
  const rec = store.enqueue({ roomId, senderId, author: senderId, text, clientMsgId, messageId, timestamp });
  res.json({
    code: 0,
    message: 'success',
    data: { id: rec.id, duplicate: !!rec.duplicate },
  });
});

app.get('/api/moderation/comments/pending', requireAdmin, (req, res) => {
  const roomId = String(req.query.roomId || '');
  if (!roomId) return res.json({ code: -1, message: 'roomId required' });
  res.json({ code: 0, message: 'success', data: { list: store.listPending(roomId).map(contractView) } });
});

app.get('/api/moderation/comments/published', (req, res) => {
  const roomId = String(req.query.roomId || '');
  if (!roomId) return res.json({ code: -1, message: 'roomId required' });
  const since = Number(req.query.since || 0);
  const limit = Number(req.query.limit || 100);
  const list = store.listPublished({ roomId, since, limit }).map(contractView);
  res.json({ code: 0, message: 'success', data: { list, serverTime: Date.now() } });
});

app.post('/api/moderation/comments/:commentId/approve', requireAdmin, async (req, res) => {
  const r = store.setStatus(req.params.commentId, 'approved');
  if (!r) return res.status(404).json({ code: -1, message: 'not found' });
  const push = await pushApprovedToRoom(r);
  res.json({ code: 0, message: 'success', data: { item: contractView(r), push } });
});

app.post('/api/moderation/comments/:commentId/reject', requireAdmin, (req, res) => {
  const r = store.setStatus(req.params.commentId, 'rejected');
  if (!r) return res.status(404).json({ code: -1, message: 'not found' });
  res.json({ code: 0, message: 'success', data: { ok: true } });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[audit-server] http://127.0.0.1:${PORT}  (ADMIN_TOKEN header: X-Admin-Token)`);
  console.log(`[audit-server] push_approved_to_room=${PUSH_APPROVED_TO_ROOM}, manager_api=${MANAGER_API_BASE}`);
});
