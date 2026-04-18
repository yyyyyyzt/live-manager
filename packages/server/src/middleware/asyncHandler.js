const logger = require('../utils/logger.js');

/**
 * 自定义校验错误类
 * format: 'trtc' => { ErrorCode, ErrorMessage }
 * format: 'local' => { code, message }
 */
class ValidationError extends Error {
  constructor(message, format = 'trtc') {
    super(message);
    this.name = 'ValidationError';
    this.format = format;
  }
}

/**
 * 异步路由处理器包装器
 * 自动 catch 异常并返回统一格式的错误响应
 *
 * @param {Function} fn - async (req, res) => void
 * @param {string} label - 接口标识，用于兜底错误消息（如 'destroy_room'）
 * @param {'trtc'|'local'} [defaultFormat='trtc'] - 默认错误响应格式
 */
function asyncHandler(fn, label = 'request', defaultFormat = 'trtc') {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // 记录错误日志
      logger.apiError(label, req, error);

      // ValidationError 使用自身携带的 format
      const format = error instanceof ValidationError
        ? error.format
        : (error?.ErrorCode !== undefined ? 'trtc' : defaultFormat);

      const msg = error?.ErrorMessage || error?.ErrorInfo || error?.message || `${label} failed`;

      if (format === 'trtc') {
        res.json({ ErrorCode: -1, ErrorMessage: msg });
      } else {
        res.json({ code: -1, message: msg });
      }
    });
  };
}

module.exports = { asyncHandler, ValidationError };
