/**
 * 机器人关键词规则（测试用内存）。后期可改为房间 Metadata 或 Redis。
 * @type {Map<string, object>}
 */
const rulesByRoom = new Map();

const DEFAULT_RULES = () => ({
  enabled: false,
  /** @type {{ keyword: string, reply: string, match?: 'contains' | 'exact' }[]} */
  keywordReplies: [],
});

function getRules(roomId) {
  if (!rulesByRoom.has(roomId)) {
    rulesByRoom.set(roomId, DEFAULT_RULES());
  }
  return rulesByRoom.get(roomId);
}

function setRules(roomId, body) {
  const next = {
    ...DEFAULT_RULES(),
    ...body,
    keywordReplies: Array.isArray(body.keywordReplies) ? body.keywordReplies : [],
  };
  rulesByRoom.set(roomId, next);
  return next;
}

module.exports = { getRules, setRules };
