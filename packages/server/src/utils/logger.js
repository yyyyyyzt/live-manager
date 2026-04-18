/**
 * 统一日志工具
 * 用于记录服务端请求和错误信息
 */

const formatTime = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

const logger = {
  /**
   * 记录错误日志
   * @param {string} context - 错误上下文（如接口名称）
   * @param {Error|string} error - 错误对象或错误消息
   * @param {object} [details] - 额外的详细信息
   */
  error(context, error, details = {}) {
    const timestamp = formatTime();
    const errorMsg = error instanceof Error 
      ? `${error.message}\nStack: ${error.stack}` 
      : String(error);
    
    console.error(`[${timestamp}] [ERROR] [${context}] ${errorMsg}`);
    
    if (Object.keys(details).length > 0) {
      console.error(`[${timestamp}] [ERROR] [${context}] Details:`, JSON.stringify(details, null, 2));
    }
  },

  /**
   * 记录警告日志
   * @param {string} context - 警告上下文
   * @param {string} message - 警告消息
   * @param {object} [details] - 额外的详细信息
   */
  warn(context, message, details = {}) {
    const timestamp = formatTime();
    console.warn(`[${timestamp}] [WARN] [${context}] ${message}`);
    
    if (Object.keys(details).length > 0) {
      console.warn(`[${timestamp}] [WARN] [${context}] Details:`, JSON.stringify(details, null, 2));
    }
  },

  /**
   * 记录信息日志
   * @param {string} context - 信息上下文
   * @param {string} message - 信息消息
   * @param {object} [details] - 额外的详细信息
   */
  info(context, message, details = {}) {
    const timestamp = formatTime();
    console.log(`[${timestamp}] [INFO] [${context}] ${message}`);
    
    if (Object.keys(details).length > 0) {
      console.log(`[${timestamp}] [INFO] [${context}] Details:`, JSON.stringify(details, null, 2));
    }
  },

  /**
   * 记录API请求错误（包含请求和响应信息）
   * @param {string} apiName - API名称
   * @param {object} req - 请求对象
   * @param {object} error - 错误对象
   */
  apiError(apiName, req, error) {
    const timestamp = formatTime();
    const requestInfo = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      }
    };

    console.error(`[${timestamp}] [API_ERROR] [${apiName}] Request failed`);
    console.error(`[${timestamp}] [API_ERROR] [${apiName}] Request Info:`, JSON.stringify(requestInfo, null, 2));
    
    if (error.response) {
      // HTTP错误响应
      console.error(`[${timestamp}] [API_ERROR] [${apiName}] Response Status: ${error.response.status}`);
      console.error(`[${timestamp}] [API_ERROR] [${apiName}] Response Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error(`[${timestamp}] [API_ERROR] [${apiName}] No response received`);
    } else {
      // 其他错误
      console.error(`[${timestamp}] [API_ERROR] [${apiName}] Error:`, error.message || error);
    }
  }
};

module.exports = logger;
