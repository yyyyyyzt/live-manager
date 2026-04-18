/**
 * 请求上下文（基于 AsyncLocalStorage）
 * 用于在请求链路中传递前端透传的凭证信息
 */
const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

/**
 * Express 中间件：将请求级别的 credentials 存入 AsyncLocalStorage
 */
function requestContextMiddleware(req, res, next) {
  const store = { credentials: req.credentials || null };
  requestContext.run(store, () => next());
}

/**
 * 获取当前请求的透传凭证
 * @returns {{ sdkAppId: number, userId: string, userSig: string } | null}
 */
function getRequestCredentials() {
  const store = requestContext.getStore();
  return store ? store.credentials : null;
}

module.exports = { requestContext, requestContextMiddleware, getRequestCredentials };
