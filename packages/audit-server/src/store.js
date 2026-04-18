/**
 * 评论审核存储（内存实现）。
 * SWAP: 生产多实例请替换为 RedisCommentStore，实现相同接口。
 */

/** @typedef {{ id: string, roomId: string, author: string, text: string, status: 'pending'|'approved'|'rejected', createdAt: string }} CommentRecord */

/** @type {Map<string, CommentRecord>} */
const byId = new Map();

export function enqueue({ roomId, author, text }) {
  const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const rec = {
    id,
    roomId,
    author: String(author || 'anonymous'),
    text: String(text || ''),
    status: /** @type {'pending'} */ ('pending'),
    createdAt: new Date().toISOString(),
  };
  byId.set(id, rec);
  return rec;
}

export function listPending(roomId) {
  return [...byId.values()].filter((r) => r.roomId === roomId && r.status === 'pending');
}

export function get(id) {
  return byId.get(id);
}

export function setStatus(id, status) {
  const r = byId.get(id);
  if (!r) return null;
  r.status = status;
  return r;
}

export function snapshotJson() {
  return JSON.stringify([...byId.values()], null, 2);
}
