const { Router } = require('express');
const multer = require('multer');
const { getUserSig, getBasicInfo, generateUserSigWithKey } = require('../config/basic-info-config.js');
const { Config } = require('../../config/index.js');
const { isUploadEnabled, getUploadConfig, generateKey, uploadFile } = require('../services/storage/index.js');
const { asyncHandler } = require('../middleware/asyncHandler');
const { isServerConfigured } = require('../middleware/credentialProxy.js');
const logger = require('../utils/logger.js');

// multer 配置：内存存储，限制 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4'];
    const allowedExtensions = ['.svga'];
    const fileExtension = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      const error = new Error('仅支持 JPG/PNG/GIF/WebP/SVG/SVGA/MP4 格式的文件');
      logger.warn('UPLOAD_FILE_FILTER', error.message, { mimetype: file.mimetype, originalname: file.originalname });
      cb(error);
    }
  },
});

// Multer 错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer 错误
    logger.error('UPLOAD_MULTER', err, { field: err.field, code: err.code });
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ code: -1, message: '文件大小超过限制(最大10MB)' });
    } else {
      res.status(400).json({ code: -1, message: err.message });
    }
  } else if (err) {
    // 其他错误
    logger.error('UPLOAD_ERROR', err);
    res.status(400).json({ code: -1, message: err.message });
  } else {
    next();
  }
};

const apiRouter = Router();

// ========== 认证与配置 ==========

// 检查 server 端配置状态
apiRouter.get('/check_config', (req, res) => {
  const configured = isServerConfigured();
  const hasSdkAppId = Config.SdkAppId > 0;
  const hasSecretKey = !!Config.SecretKey;
  const hasIdentifier = !!Config.Identifier;
  res.json({
    code: 0,
    message: 'success',
    data: {
      configured,
      sdkAppId: hasSdkAppId ? Config.SdkAppId : 0,
      hasSdkAppId,
      hasSecretKey,
      hasIdentifier,
      identifier: hasIdentifier ? Config.Identifier : '',
    },
  });
});

// 登录
apiRouter.post('/login', (req, res) => {
  const hasSdkAppId = Config.SdkAppId > 0;
  const hasSecretKey = !!Config.SecretKey;
  const hasIdentifier = !!Config.Identifier;

  // 从请求体获取前端传来的凭证
  let { userId, userSig, sdkAppId, secretKey, domain } = req.body;
  const hasFrontendSdkAppId = !!sdkAppId;
  const hasFrontendUserSig = !!userSig;
  const hasFrontendSecretKey = !!secretKey;

  logger.info('LOGIN', '收到登录请求', {
    serverConfigured: isServerConfigured(),
    hasSdkAppId,
    hasSecretKey,
    hasIdentifier,
    hasFrontendSdkAppId,
    hasFrontendUserSig,
    frontendSdkAppId: sdkAppId,
  });

  // 前端传了 sdkAppId + userSig → URL 覆盖模式，优先使用前端凭证
  if (hasFrontendSdkAppId && hasFrontendUserSig) {
    const usedDomain = domain || (sdkAppId < 1400000000 ? 'adminapisgp.im.qcloud.com' : 'console.tim.qq.com');
    logger.info('LOGIN', '✅ URL 覆盖模式登录成功', {
      sdkAppId: Number(sdkAppId),
      userId,
      domain: usedDomain,
    });
    res.json({
      code: 0,
      message: 'success',
      data: {
        token: `proxy_${Date.now()}`,
        userId,
        userName: userId,
        sdkAppId: Number(sdkAppId),
        userSig,
        configured: false,
        domain: usedDomain,
      },
    });
    return;
  }

  // 前端传了 sdkAppId + secretKey（URL override 模式）→ 用前端密钥生成匹配的 userSig
  if (hasFrontendSdkAppId && hasFrontendSecretKey && !hasFrontendUserSig) {
    const usedDomain = domain || (sdkAppId < 1400000000 ? 'adminapisgp.im.qcloud.com' : 'console.tim.qq.com');
    const usedIdentifier = userId || Config.Identifier || 'administrator';
    const userSig = generateUserSigWithKey(sdkAppId, secretKey, usedIdentifier);
    if (!userSig) {
      logger.error('LOGIN', '生成 UserSig 失败', { sdkAppId, identifier: usedIdentifier });
      res.json({ code: -1, message: '生成 UserSig 失败' });
      return;
    }
    logger.info('LOGIN', '✅ URL 覆盖模式登录成功', {
      sdkAppId: Number(sdkAppId),
      userId: usedIdentifier,
      domain: usedDomain,
    });
    res.json({
      code: 0,
      message: 'success',
      data: {
        token: `proxy_${Date.now()}`,
        userId: usedIdentifier,
        userName: '超级管理员',
        sdkAppId: Number(sdkAppId),
        userSig,
        configured: false,
        domain: usedDomain,
      },
    });
    return;
  }

  // server 已完整配置：直接返回凭证，无需密码
  if (isServerConfigured()) {
    // 自动生成管理员 UserSig 返回给前端
    const sigInfo = getUserSig(Config.Identifier);
    logger.info('LOGIN', '✅ 服务端配置模式登录成功', {
      sdkAppId: Config.SdkAppId,
      userId: Config.Identifier,
    });
    res.json({
      code: 0,
      message: 'success',
      data: {
        token: 'auto_token_' + Date.now(),
        userId: Config.Identifier,
        userName: '超级管理员',
        sdkAppId: Config.SdkAppId,
        userSig: sigInfo ? sigInfo.UserSig : '',
        configured: true,
        domain: Config.Domain,
      }
    });
    return;
  }

  // server 未完整配置：凭证模式（需要前端提供凭证）
  // 服务端配置作为 fallback
  if (!sdkAppId && hasSdkAppId) sdkAppId = Config.SdkAppId;
  if (!userId && hasIdentifier) userId = Config.Identifier;
  // domain 留空则使用服务器配置的 Domain
  const usedDomain = domain || Config.Domain;

  if (!userId || !userSig || !sdkAppId) {
    const errorMsg = '请提供 UserId、UserSig 和 SdkAppId';
    logger.warn('LOGIN', errorMsg, { hasUserId: !!userId, hasUserSig: !!userSig, hasSdkAppId: !!sdkAppId });
    res.json({ code: -1, message: errorMsg });
    return;
  }

  logger.info('LOGIN', '✅ 前端凭证模式登录成功', {
    sdkAppId: Number(sdkAppId),
    userId,
  });
  res.json({
    code: 0,
    message: 'success',
    data: {
      token: `proxy_${Date.now()}`,
      userId,
      userName: userId,
      sdkAppId: Number(sdkAppId),
      userSig,
      configured: false,
      domain: usedDomain,
    },
  });
});

// 生成 UserSig
apiRouter.post('/get_user_sig', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    const errorMsg = 'userId is required';
    logger.warn('GET_USER_SIG', errorMsg, { body: req.body });
    res.json({ code: -1, message: errorMsg });
    return;
  }

  if (!isServerConfigured()) {
    const errorMsg = '服务端未配置 SecretKey，无法生成 UserSig';
    logger.warn('GET_USER_SIG', errorMsg, { userId });
    res.json({ code: -1, message: errorMsg });
    return;
  }

  const info = getUserSig(String(userId));
  if (!info || !info.UserSig) {
    const errorMsg = 'UserSig is undefined';
    logger.error('GET_USER_SIG', errorMsg, { userId, info });
    res.json({ code: -1, message: errorMsg });
    return;
  }
  res.json({
    code: 0,
    message: 'success',
    data: {
      sdkAppId: info.SdkAppId,
      userId: info.UserId,
      userSig: info.UserSig,
      userName: info.UserName,
    }
  });
});

// ========== 文件上传（COS） ==========

// 获取上传配置状态
apiRouter.get('/upload/config', (req, res) => {
  const config = getUploadConfig();
  res.json({ code: 0, message: 'success', data: config });
});

// 通用图片上传
apiRouter.post('/upload/image', upload.single('file'), asyncHandler(async (req, res) => {
  if (!isUploadEnabled()) {
    const errorMsg = '存储服务未配置，无法上传文件';
    logger.warn('UPLOAD_IMAGE', errorMsg);
    res.status(400).json({ code: -1, message: errorMsg });
    return;
  }
  if (!req.file) {
    const errorMsg = '请选择要上传的文件';
    logger.warn('UPLOAD_IMAGE', errorMsg, { body: req.body });
    res.status(400).json({ code: -1, message: errorMsg });
    return;
  }

  const type = req.body.type || 'cover';
  const key = generateKey(type, req.file.originalname);
  const result = await uploadFile(req.file.buffer, key, req.file.mimetype);

  res.json({
    code: 0,
    message: 'success',
    data: {
      url: result.url,
      key: result.key,
      size: req.file.size,
      mimetype: req.file.mimetype,
      provider: getUploadConfig().provider,
    },
  });
}, 'upload_image', 'local'));

// ========== 通用 TRTC API 代理 ==========
// 前端将 TRTC API 路径和 body 传过来，server 负责拼接凭证并转发
// 这样前端业务逻辑完全自主，server 仅做身份认证 + HTTP 中转

const axios = require('axios');

// 限频队列
const TRTC_REQUEST_INTERVAL = 1100;
let lastTrtcRequestTime = 0;
let trtcRequestQueue = Promise.resolve();

const TRTC_RATE_LIMIT_WHITELIST = new Set([
  'get_room_info',
  'get_room_list',
  'get_room_metadata',
  'get_gift_info_list',
  'portrait_get',        // 用户资料查询（只读），不需要限频
  'get_room_statistic',  // 房间统计（只读），不需要限频
]);

async function doTrtcRequest(url, data) {
  try {
    const response = await axios.post(url, data, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    // 记录详细的错误日志
    logger.error('TRTC_REQUEST', error, {
      url: url.substring(0, url.indexOf('?')), // 隐藏敏感参数
      requestData: data,
      responseStatus: error.response?.status,
      responseData: error.response?.data
    });
    
    if (error.response) {
      return error.response.data || { ErrorCode: -1, ErrorInfo: 'Request failed' };
    }
    return { ErrorCode: -1, ErrorInfo: 'Network error', originalError: error.message };
  }
}

/**
 * 获取凭证（复用函数）
 * 中间件已通过 req.credentials 决定了凭证来源：
 * - req.credentials 有值 → 使用前端透传凭证（覆盖模式 或 server 未配置模式）
 * - req.credentials 为 null → 使用服务端配置凭证
 */
function getCredentials(req) {
  // 中间件设置了前端凭证（覆盖模式 或 server 未配置）
  const proxied = req.credentials;
  if (proxied && proxied.sdkAppId && proxied.userId && proxied.userSig) {
    logger.info('GET_CREDS', '✅ 使用前端透传凭证', {
      source: 'frontend_proxy',
      sdkAppId: proxied.sdkAppId,
      userId: proxied.userId,
    });
    return { sdkAppId: proxied.sdkAppId, identifier: proxied.userId, userSig: proxied.userSig };
  }

  // 使用服务端配置
  if (isServerConfigured()) {
    const userInfo = getBasicInfo();
    if (userInfo && userInfo.UserSig) {
      logger.info('GET_CREDS', '✅ 使用服务端配置凭证', {
        source: 'server_config',
        sdkAppId: Config.SdkAppId,
        identifier: userInfo.UserId,
      });
      return { sdkAppId: Config.SdkAppId, identifier: userInfo.UserId, userSig: userInfo.UserSig };
    }
  }

  logger.warn('GET_CREDS', '❌ 无可用凭证', {
    serverConfigured: isServerConfigured(),
    hasProxiedCreds: !!proxied,
  });
  return null;
}

/**
 * 执行 TRTC API 代理请求（复用函数）
 * 包含限频控制和白名单处理
 */
// SSRF 防护：允许的域名白名单（支持通配符 *.im.qcloud.com 和 *.tim.qq.com）
const ALLOWED_DOMAIN_PATTERN = /^(adminapisgp\.im\.qcloud\.com|console\.tim\.qq\.com|[\w-]+\.im\.qcloud\.com|[\w-]+\.tim\.qq\.com)$/;

// SSRF 防护：阻止请求内网地址（元数据服务、私有 IP 等）
const BLOCKED_HOSTS = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.)/i;

async function executeTrtcProxy(creds, apiPath, body, domainOverride) {
  const domain = domainOverride || process.env.DOMAIN || (creds.sdkAppId < 1400000000 ? 'adminapisgp.im.qcloud.com' : 'console.tim.qq.com');

  // SSRF 校验：域名白名单
  if (!ALLOWED_DOMAIN_PATTERN.test(domain)) {
    logger.warn('TRTC_PROXY_SSRF', '拒绝请求：域名不在白名单中', { domain });
    return { ErrorCode: -1, ErrorInfo: 'Invalid domain' };
  }

  const random = Math.floor(Math.random() * 1000000000);
  const url = `https://${domain}/${apiPath}?sdkappid=${creds.sdkAppId}&identifier=${creds.identifier}&usersig=${creds.userSig}&random=${random}&contenttype=json`;

  logger.info('TRTC_PROXY', `🌐 请求云端 API: ${apiPath}`, {
    sdkAppId: creds.sdkAppId,
    identifier: creds.identifier,
    domain,
    apiPath,
    bodyKeys: body ? Object.keys(body) : [],
    body: body || {},
  });

  // 判断是否走限频队列
  const apiName = apiPath.split('/').pop() || '';
  if (TRTC_RATE_LIMIT_WHITELIST.has(apiName)) {
    const result = await doTrtcRequest(url, body || {});
    logger.info('TRTC_PROXY', `📥 云端响应 (${apiPath})`, {
      sdkAppId: creds.sdkAppId,
      errorCode: result?.ErrorCode,
      errorInfo: result?.ErrorInfo,
      hasData: !!result,
    });
    return result;
  }

  // 非白名单走排队
  return new Promise((resolve, reject) => {
    trtcRequestQueue = trtcRequestQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - lastTrtcRequestTime;
      if (elapsed < TRTC_REQUEST_INTERVAL) {
        await new Promise(r => setTimeout(r, TRTC_REQUEST_INTERVAL - elapsed));
      }
      try {
        const result = await doTrtcRequest(url, body || {});
        lastTrtcRequestTime = Date.now();
        logger.info('TRTC_PROXY', `📥 云端响应 (${apiPath})`, {
          sdkAppId: creds.sdkAppId,
          errorCode: result?.ErrorCode,
          errorInfo: result?.ErrorInfo,
          hasData: !!result,
        });
        resolve(result);
      } catch (error) {
        lastTrtcRequestTime = Date.now();
        reject(error);
      }
    });
  });
}

apiRouter.post('/trtc_proxy', asyncHandler(async (req, res) => {
  const { apiPath, body: trtcBody, domain } = req.body;
  if (!apiPath) {
    const errorMsg = 'apiPath is required';
    logger.warn('TRTC_PROXY', errorMsg, { body: req.body });
    res.json({ ErrorCode: -1, ErrorInfo: errorMsg });
    return;
  }

  const creds = getCredentials(req);
  if (!creds) {
    const errorMsg = 'No credentials available';
    logger.warn('TRTC_PROXY', errorMsg, { apiPath });
    res.status(401).json({ ErrorCode: -1, ErrorInfo: errorMsg });
    return;
  }

  const result = await executeTrtcProxy(creds, apiPath, trtcBody, domain);
  res.json(result);
}, 'trtc_proxy'));

// ========== 兼容 tuikit-atomicx-react 的 API 路由 ==========
// 复用 trtc_proxy 的通用处理逻辑

// API 路径映射：前端路由名 -> TRTC API 路径
const TUIKIT_API_MAP = {
  'get_live_list': 'v4/live_engine_http_srv/get_room_list',
  'destroy_room': 'v4/live_engine_http_srv/destroy_room',
  'get_room_info': 'v4/live_engine_http_srv/get_room_info',
};

/**
 * 通用的 tuikit 兼容路由处理器
 */
function createTuikitProxyHandler(routeName) {
  return asyncHandler(async (req, res) => {
    const creds = getCredentials(req);
    if (!creds) {
      const errorMsg = 'No credentials available';
      logger.warn(`TUIKIT_PROXY_${routeName.toUpperCase()}`, errorMsg);
      res.status(401).json({ ErrorCode: -1, ErrorInfo: errorMsg });
      return;
    }

    const apiPath = TUIKIT_API_MAP[routeName];
    const result = await executeTrtcProxy(creds, apiPath, req.body);
    res.json(result);
  }, routeName);
}

// 注册三个兼容路由
apiRouter.post('/get_live_list', createTuikitProxyHandler('get_live_list'));
apiRouter.post('/destroy_room', createTuikitProxyHandler('destroy_room'));
apiRouter.post('/get_room_info', createTuikitProxyHandler('get_room_info'));

// ========== 健康检查 ==========

apiRouter.get('/test', (_, res) => {
  res.json({ result: 'success' });
});

module.exports = { apiRouter };
