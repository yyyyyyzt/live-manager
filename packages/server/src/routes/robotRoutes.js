const { Router } = require('express');
const robotStore = require('../services/robot/memoryRobotRulesStore.js');

const router = Router();

function ok(res, data) {
  res.json({ code: 0, message: 'success', data });
}

function bad(res, message, status = 400) {
  res.status(status).json({ code: -1, message });
}

/**
 * GET /api/robot/rules?roomId=
 * 占位：测试阶段存内存；后续可同步到 set_room_metadata。
 */
router.get('/rules', (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return bad(res, 'roomId is required');
  const rules = robotStore.getRules(String(roomId));
  return ok(res, { rules });
});

/**
 * PUT /api/robot/rules?roomId=
 * body: { enabled?: boolean, keywordReplies?: { keyword, reply, match? }[] }
 */
router.put('/rules', (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return bad(res, 'roomId is required');
  const rules = robotStore.setRules(String(roomId), req.body || {});
  return ok(res, { rules });
});

module.exports = router;
