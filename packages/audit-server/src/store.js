/**
 * 评论审核存储（内存实现）。
 *
 * SWAP: 生产多实例请替换为 RedisCommentStore，保持相同导出的函数签名：
 *   enqueue(input)         -> CommentRecord | { ...rec, duplicate: boolean }
 *   listPending(roomId)    -> CommentRecord[]
 *   listPublished(opts)    -> CommentRecord[]
 *   get(id)                -> CommentRecord | undefined
 *   setStatus(id, status)  -> CommentRecord | null
 *   snapshotJson()         -> string
 *
 * Redis 建议 KEY 设计（仅供参考，具体以 rules 为准）：
 *   moderation:comment:{id}                 HASH（评论记录）
 *   moderation:room:{roomId}:pending        ZSET by createdAtMs
 *   moderation:room:{roomId}:published      ZSET by approvedAtMs
 *   moderation:room:{roomId}:dedupe         HASH<clientMsgId, id>（可加 TTL）
 */

/** @typedef {{
 *  id: string,
 *  roomId: string,
 *  author: string,
 *  senderId?: string,
 *  text: string,
 *  status: 'pending'|'approved'|'rejected',
 *  clientMsgId?: string,
 *  messageId?: string,
 *  createdAt: number,
 *  approvedAt?: number,
 *  rejectedAt?: number,
 * }} CommentRecord */

/** @type {Map<string, CommentRecord>} */
const byId = new Map();
/** @type {Map<string, string>} key = `${roomId}|${clientMsgId}` -> id */
const dedupeIndex = new Map();

const TEXT_MAX = 4000;

function nowMs() {
  return Date.now();
}

function newId() {
  return `c_${nowMs()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(text) {
  const s = String(text || '').trim();
  return s.length > TEXT_MAX ? s.slice(0, TEXT_MAX) : s;
}

/**
 * 入队待审
 * @param {{
 *   roomId: string,
 *   author?: string,
 *   senderId?: string,
 *   text: string,
 *   clientMsgId?: string,
 *   messageId?: string,
 *   timestamp?: number,
 * }} input
 * @returns {CommentRecord & { duplicate?: boolean }}
 */
export function enqueue(input) {
  const roomId = String(input.roomId || '');
  const author = String(input.author ?? input.senderId ?? 'anonymous');
  const senderId = String(input.senderId ?? input.author ?? 'anonymous');
  const text = normalizeText(input.text);
  const clientMsgId = input.clientMsgId ? String(input.clientMsgId) : undefined;
  const messageId = input.messageId ? String(input.messageId) : undefined;
  const createdAt = Number(input.timestamp) > 0 ? Number(input.timestamp) : nowMs();

  if (clientMsgId) {
    const dedupeKey = `${roomId}|${clientMsgId}`;
    const existId = dedupeIndex.get(dedupeKey);
    if (existId) {
      const exist = byId.get(existId);
      if (exist) {
        return { ...exist, duplicate: true };
      }
    }
  }

  const id = newId();
  /** @type {CommentRecord} */
  const rec = {
    id,
    roomId,
    author,
    senderId,
    text,
    status: 'pending',
    clientMsgId,
    messageId,
    createdAt,
  };
  byId.set(id, rec);
  if (clientMsgId) {
    dedupeIndex.set(`${roomId}|${clientMsgId}`, id);
  }
  return { ...rec, duplicate: false };
}

export function listPending(roomId) {
  return [...byId.values()]
    .filter((r) => r.roomId === roomId && r.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * 拉取已通过（approved）的评论（支持增量 since / limit）
 * @param {{ roomId: string, since?: number, limit?: number }} opts
 */
export function listPublished({ roomId, since = 0, limit = 100 }) {
  const cap = Math.min(Math.max(1, Number(limit) || 100), 500);
  const after = Number(since) || 0;
  return [...byId.values()]
    .filter((r) => r.roomId === roomId && r.status === 'approved' && (r.approvedAt || 0) > after)
    .sort((a, b) => (a.approvedAt || 0) - (b.approvedAt || 0))
    .slice(0, cap);
}

export function get(id) {
  return byId.get(id);
}

export function setStatus(id, status) {
  const r = byId.get(id);
  if (!r) return null;
  r.status = status;
  if (status === 'approved') r.approvedAt = nowMs();
  if (status === 'rejected') r.rejectedAt = nowMs();
  return r;
}

export function snapshotJson() {
  return JSON.stringify([...byId.values()], null, 2);
}
