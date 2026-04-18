/**
 * 主播入口 Token（HMAC 签名，无状态）
 *
 * 形态：base64url(payload).base64url(sig)
 *   payload = { r: roomId, u: userId, exp: <seconds>, n: <nonce> }
 *   sig     = HMAC-SHA256(payload, secret)
 *
 * 用途：管理端「建场」后生成一次性可复制链接，主播页面打开后调用
 * `/api/host_entry/consume` 换取短期的 sdkAppId + userId + userSig 进入直播间。
 *
 * 注意：消费时并不做「一次性」硬限制（无状态），仅靠短 TTL（默认 5 分钟）约束。
 * 如果需要严格一次性，可在内存/Redis 中维护已消费 nonce 列表。
 */
const crypto = require('crypto');
const { Config } = require('../../config/index.js');

const DEFAULT_TTL_SECONDS = 5 * 60;

function getSecret() {
  return process.env.HOST_ENTRY_SECRET || Config.SecretKey || 'host-entry-dev-secret';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(str) {
  str = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return Buffer.from(str, 'base64');
}

function sign(payloadStr) {
  return crypto.createHmac('sha256', getSecret()).update(payloadStr).digest();
}

function createToken({ roomId, userId, ttlSeconds }) {
  if (!roomId || !userId) return null;
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Number(ttlSeconds) : DEFAULT_TTL_SECONDS;
  const payload = {
    r: String(roomId),
    u: String(userId),
    exp: now + ttl,
    n: crypto.randomBytes(6).toString('hex'),
  };
  const payloadStr = JSON.stringify(payload);
  const encoded = b64url(payloadStr);
  const sig = b64url(sign(encoded));
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'invalid_format' };
  }
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return { ok: false, error: 'invalid_format' };

  const expected = b64url(sign(encoded));
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return { ok: false, error: 'bad_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(encoded).toString('utf8'));
  } catch {
    return { ok: false, error: 'bad_payload' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload.exp !== 'number' || payload.exp < now) {
    return { ok: false, error: 'expired' };
  }
  if (!payload.r || !payload.u) {
    return { ok: false, error: 'missing_claims' };
  }
  return { ok: true, roomId: payload.r, userId: payload.u, exp: payload.exp };
}

module.exports = { createToken, verifyToken, DEFAULT_TTL_SECONDS };
