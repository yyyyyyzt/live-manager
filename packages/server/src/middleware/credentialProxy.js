/**
 * 凭证透传中间件
 * 当 server 端未配置 SecretKey/SdkAppId 时，从请求 header 中提取前端透传的凭证
 */
const { Config } = require('../../config/index.js');
const { getUserSig: generateUserSig } = require('../config/basic-info-config.js');
const logger = require('../utils/logger.js');

/**
 * 判断 server 端是否已完整配置（有 SecretKey 且有 SdkAppId）
 */
function isServerConfigured() {
  return !!(Config.SecretKey && Config.SdkAppId > 0);
}

/**
 * 从请求 header 中提取前端透传的凭证信息
 */
function extractCredentials(req) {
  return {
    sdkAppId: Number(req.headers['x-sdk-app-id'] || 0),
    userId: req.headers['x-user-id'] || '',
    userSig: req.headers['x-user-sig'] || '',
  };
}

/**
 * 凭证透传中间件
 * - 如果 server 已配置，使用 server 自身凭证
 * - 如果 server 未配置，从 header 提取前端透传的凭证并挂载到 req.credentials
 * - URL 覆盖模式下，前端会在本地计算 userSig 并通过标准 header 透传
 */
function credentialProxy(req, res, next) {
  // 先检查前端是否透传了凭证
  const creds = extractCredentials(req);
  const hasFrontendCreds = creds.sdkAppId > 0 && creds.userId && creds.userSig;

  // 判断是否是覆盖模式：前端传了完整凭证，且 sdkAppId 与 server 配置不同
  const isOverrideMode = hasFrontendCreds && (!isServerConfigured() || creds.sdkAppId !== Config.SdkAppId);

  if (isOverrideMode) {
    // 前端传的 sdkAppId 与 server 不同 → 覆盖模式，使用前端凭证
    logger.info('CREDENTIAL', `[${req.method} ${req.path}] 使用前端透传凭证（覆盖模式）`, {
      frontendSdkAppId: creds.sdkAppId,
      serverSdkAppId: Config.SdkAppId || 'N/A',
      userId: creds.userId,
    });
    req.credentials = creds;
    return next();
  }

  // 非覆盖模式：优先用 server 配置
  if (isServerConfigured()) {
    logger.info('CREDENTIAL', `[${req.method} ${req.path}] 使用服务端配置凭证`, {
      sdkAppId: Config.SdkAppId,
      identifier: Config.Identifier,
      frontendSdkAppId: creds.sdkAppId || 'N/A',
      note: hasFrontendCreds ? '前端也传了凭证但sdkAppId相同，优先用server' : '前端未传凭证',
    });
    req.credentials = null;
    return next();
  }

  // server 也没配置

  // 前端传了完整凭证（但 sdkAppId 碰巧和 server 的一样，上面已排除）
  if (hasFrontendCreds) {
    logger.info('CREDENTIAL', `[${req.method} ${req.path}] 使用前端透传凭证（server未配置）`, {
      sdkAppId: creds.sdkAppId,
      userId: creds.userId,
    });
    req.credentials = creds;
    return next();
  }

  // 对于 check_config、login、评论审核、机器人占位接口不要求 TRTC 凭证（观众端可上报待审评论）
  const skipPaths = ['/api/check_config', '/api/login'];
  const skipPrefixes = ['/api/moderation', '/api/robot'];
  if (
    skipPaths.includes(req.path) ||
    skipPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(prefix + '/'))
  ) {
    req.credentials = null;
    logger.info('CREDENTIAL', `[${req.method} ${req.path}] 跳过凭证检查（公开/审核/机器人接口）`);
    return next();
  }

  // 其他接口需要凭证但都没有
  logger.warn('CREDENTIAL', `[${req.method} ${req.path}] 无可用凭证，拒绝请求`, {
    sdkAppId: creds.sdkAppId,
    userId: creds.userId || '(空)',
    hasUserSig: !!creds.userSig,
  });
  return res.status(401).json({
    code: -1,
    message: '服务端未配置凭证，请先登录并提供 SdkAppId、UserId 和 UserSig',
  });
}

module.exports = { credentialProxy, isServerConfigured, extractCredentials };
