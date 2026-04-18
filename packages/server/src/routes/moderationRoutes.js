const { Router } = require('express');
const moderationStore = require('../services/moderation/memoryModerationStore.js');
const logger = require('../utils/logger.js');

const router = Router();

function ok(res, data) {
  res.json({ code: 0, message: 'success', data });
}

function bad(res, message, status = 400) {
  res.status(status).json({ code: -1, message });
}

/**
 * 观众端 / 网关上报待审评论
 * POST /api/moderation/comments
 * body: { roomId, senderId, text, clientMsgId? }
 */
router.post('/comments', (req, res) => {
  try {
    const { roomId, senderId, text, clientMsgId } = req.body || {};
    const result = moderationStore.enqueue({ roomId, senderId, text, clientMsgId });
    if (result.duplicate) {
      return ok(res, { id: result.id, duplicate: true });
    }
    logger.info('MODERATION_ENQUEUE', 'pending comment', { roomId, id: result.id });
    return ok(res, { id: result.id, duplicate: false });
  } catch (e) {
    logger.warn('MODERATION_ENQUEUE', e.message);
    return bad(res, e.message);
  }
});

/**
 * 管理端：待审列表
 * GET /api/moderation/comments/pending?roomId=
 */
router.get('/comments/pending', (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return bad(res, 'roomId is required');
  const list = moderationStore.getPendingList(String(roomId));
  return ok(res, { list, serverTime: Date.now() });
});

/**
 * 观众端：拉取已通过评论（轮询）
 * GET /api/moderation/comments/published?roomId=&since=0&limit=100
 */
router.get('/comments/published', (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return bad(res, 'roomId is required');
  const since = Number(req.query.since) || 0;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const list = moderationStore.listPublishedSince(String(roomId), since, limit);
  return ok(res, { list, serverTime: Date.now() });
});

/**
 * 管理端：通过
 * POST /api/moderation/comments/:commentId/approve
 * body: { roomId }
 */
router.post('/comments/:commentId/approve', (req, res) => {
  const { roomId } = req.body || {};
  const { commentId } = req.params;
  if (!roomId) return bad(res, 'roomId is required in body');
  const published = moderationStore.approve(String(roomId), commentId);
  if (!published) return bad(res, 'comment not found or not pending', 404);
  logger.info('MODERATION_APPROVE', { roomId, commentId });
  return ok(res, { item: published });
});

/**
 * 管理端：拒绝
 * POST /api/moderation/comments/:commentId/reject
 * body: { roomId }
 */
router.post('/comments/:commentId/reject', (req, res) => {
  const { roomId } = req.body || {};
  const { commentId } = req.params;
  if (!roomId) return bad(res, 'roomId is required in body');
  const okReject = moderationStore.reject(String(roomId), commentId);
  if (!okReject) return bad(res, 'comment not found or not pending', 404);
  logger.info('MODERATION_REJECT', { roomId, commentId });
  return ok(res, { ok: true });
});

module.exports = router;
