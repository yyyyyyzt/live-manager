/**
 * 评论审核内存存储（测试用）。进程重启后数据丢失。
 * TODO: 替换为 RedisModerationStore，保持相同方法签名。
 */
const { randomUUID } = require('crypto');

/** @typedef {{ id: string, roomId: string, messageId?: string, clientMsgId?: string, senderId: string, text: string, createdAt: number }} PendingItem */
/** @typedef {PendingItem & { approvedAt: number }} PublishedItem */

/** @type {Map<string, PendingItem[]>} */
const pendingByRoom = new Map();
/** @type {Map<string, PublishedItem[]>} */
const publishedByRoom = new Map();
/** @type {Map<string, string>} roomId:clientMsgId -> pending id */
const dedupeKeyToId = new Map();

function getPendingList(roomId) {
  return pendingByRoom.get(roomId) || [];
}

function getPublishedList(roomId) {
  return publishedByRoom.get(roomId) || [];
}

/**
 * @param {{ roomId: string, senderId: string, text: string, clientMsgId?: string, messageId?: string, timestamp?: number }} input
 * @returns {{ id: string, duplicate?: boolean }}
 */
function enqueue(input) {
  const { roomId, senderId, text, clientMsgId, messageId, timestamp } = input;
  if (!roomId || !senderId || !text) {
    throw new Error('roomId, senderId, text are required');
  }
  if (clientMsgId) {
    const dk = `${roomId}:${clientMsgId}`;
    const existing = dedupeKeyToId.get(dk);
    if (existing) {
      return { id: existing, duplicate: true };
    }
  }
  const id = randomUUID();
  const createdAt = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now();
  const item = {
    id,
    roomId,
    messageId: messageId ? String(messageId) : undefined,
    clientMsgId: clientMsgId || undefined,
    senderId: String(senderId),
    text: String(text).slice(0, 4000),
    createdAt,
  };
  const list = pendingByRoom.get(roomId) || [];
  list.push(item);
  pendingByRoom.set(roomId, list);
  if (clientMsgId) {
    dedupeKeyToId.set(`${roomId}:${clientMsgId}`, id);
  }
  return { id };
}

/**
 * @param {string} roomId
 * @param {string} commentId
 * @returns {PublishedItem | null}
 */
function approve(roomId, commentId) {
  const list = pendingByRoom.get(roomId);
  if (!list) return null;
  const idx = list.findIndex((p) => p.id === commentId);
  if (idx === -1) return null;
  const [item] = list.splice(idx, 1);
  if (item.clientMsgId) {
    dedupeKeyToId.delete(`${roomId}:${item.clientMsgId}`);
  }
  const published = { ...item, approvedAt: Date.now() };
  const pubList = publishedByRoom.get(roomId) || [];
  pubList.push(published);
  publishedByRoom.set(roomId, pubList);
  return published;
}

/**
 * @param {string} roomId
 * @param {string} commentId
 * @returns {boolean}
 */
function reject(roomId, commentId) {
  const list = pendingByRoom.get(roomId);
  if (!list) return false;
  const idx = list.findIndex((p) => p.id === commentId);
  if (idx === -1) return false;
  const [item] = list.splice(idx, 1);
  if (item.clientMsgId) {
    dedupeKeyToId.delete(`${roomId}:${item.clientMsgId}`);
  }
  if (list.length === 0) pendingByRoom.delete(roomId);
  return true;
}

/**
 * @param {string} roomId
 * @param {number} [since]
 * @param {number} [limit]
 */
function listPublishedSince(roomId, since = 0, limit = 100) {
  const pubList = publishedByRoom.get(roomId) || [];
  const filtered = pubList.filter((p) => p.approvedAt > since);
  const slice = filtered.slice(-Math.min(limit, 500));
  return slice;
}

module.exports = {
  getPendingList,
  getPublishedList,
  enqueue,
  approve,
  reject,
  listPublishedSince,
};
