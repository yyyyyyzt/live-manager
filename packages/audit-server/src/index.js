import express from 'express';
import cors from 'cors';
import * as store from './store.js';

const PORT = Number(process.env.AUDIT_PORT || 3080);
const ADMIN_TOKEN = process.env.AUDIT_ADMIN_TOKEN || 'dev-admin-token';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'audit-server' });
});

/** 观众投稿 */
app.post('/api/v1/rooms/:roomId/comments', (req, res) => {
  const { roomId } = req.params;
  const { author, text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ code: 400, message: 'text required' });
  }
  const rec = store.enqueue({ roomId, author, text });
  res.status(201).json({ code: 0, data: rec });
});

function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'];
  if (t !== ADMIN_TOKEN) {
    return res.status(401).json({ code: 401, message: 'unauthorized' });
  }
  next();
}

/** 管理端拉取待审 */
app.get('/api/v1/rooms/:roomId/comments/pending', requireAdmin, (req, res) => {
  const { roomId } = req.params;
  res.json({ code: 0, data: store.listPending(roomId) });
});

app.post('/api/v1/comments/:id/approve', requireAdmin, (req, res) => {
  const r = store.setStatus(req.params.id, 'approved');
  if (!r) return res.status(404).json({ code: 404, message: 'not found' });
  // SWAP: 在此调用 TRTC send_text_msg（经 packages/server 代理）将评论送入房间
  res.json({ code: 0, data: r });
});

app.post('/api/v1/comments/:id/reject', requireAdmin, (req, res) => {
  const r = store.setStatus(req.params.id, 'rejected');
  if (!r) return res.status(404).json({ code: 404, message: 'not found' });
  res.json({ code: 0, data: r });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[audit-server] http://127.0.0.1:${PORT}  (ADMIN_TOKEN header: X-Admin-Token)`);
});
