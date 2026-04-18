const StorageProvider = require('./StorageProvider');
const { Config } = require('../../../config/index.js');

/**
 * 自定义 HTTP 上传 Provider
 *
 * 适用于已有图片上传服务的场景，将文件以 multipart/form-data 方式
 * 转发到自定义上传接口，要求接口返回 JSON 格式的上传结果。
 *
 * 所需 .env 配置：
 *   CUSTOM_UPLOAD_URL      - 上传接口地址，例如 https://your-api.com/upload
 *   CUSTOM_ACCESS_DOMAIN   - 文件访问域名前缀，例如 https://cdn.your-api.com
 *   CUSTOM_UPLOAD_FIELD    - 上传接口的文件字段名（默认: file）
 *   CUSTOM_RESPONSE_URL_FIELD - 响应中 URL 字段的 JSONPath，支持点分路径（默认: data.url）
 *   CUSTOM_AUTH_HEADER     - 可选，自定义认证请求头，格式如 "Authorization: Bearer xxx"
 *   CUSTOM_PATH_PREFIX     - 可选，存储路径前缀
 *
 * 上传接口应返回 JSON，示例：
 *   { "code": 0, "data": { "url": "https://cdn.example.com/xxx.png", "key": "xxx.png" } }
 */
class CustomProvider extends StorageProvider {
  constructor() {
    super('custom');
  }

  isEnabled() {
    return !!(Config.Custom && Config.Custom.UploadUrl);
  }

  getConfig() {
    return {
      ...super.getConfig(),
      accessDomain: Config.Custom?.AccessDomain || '',
    };
  }

  generateKey(type, originalName) {
    const prefix = Config.Custom?.PathPrefix || '';
    return super.generateKey(type, originalName, prefix);
  }

  /**
   * 从嵌套对象中按点分路径取值
   * @param {object} obj
   * @param {string} path - 如 "data.url"
   */
  _getNestedValue(obj, dotPath) {
    return dotPath.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }

  async uploadFile(fileBuffer, key, contentType) {
    const { UploadUrl, UploadField, ResponseUrlField, AuthHeader } = Config.Custom || {};
    if (!UploadUrl) throw new Error('Custom Provider 未配置 CUSTOM_UPLOAD_URL');

    // 动态导入 FormData 支持（Node 18+ 内置，低版本需 polyfill）
    const { Blob } = require('buffer');

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: contentType });
    formData.append(UploadField || 'file', blob, key.split('/').pop());
    formData.append('key', key);

    const headers = {};
    if (AuthHeader) {
      const colonIdx = AuthHeader.indexOf(':');
      if (colonIdx > 0) {
        headers[AuthHeader.substring(0, colonIdx).trim()] = AuthHeader.substring(colonIdx + 1).trim();
      }
    }

    const response = await fetch(UploadUrl, {
      method: 'POST',
      body: formData,
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Custom upload failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    const urlField = ResponseUrlField || 'data.url';
    const url = this._getNestedValue(result, urlField);

    if (!url) {
      // 回退：使用 AccessDomain + key 拼接
      const domain = Config.Custom?.AccessDomain;
      if (domain) {
        const finalUrl = `${domain.replace(/\/+$/, '')}/${key}`;
        console.log('[Custom] Upload success (fallback URL):', finalUrl);
        return { url: finalUrl, key };
      }
      throw new Error(`Custom upload: 无法从响应中提取 URL (字段路径: ${urlField})`);
    }

    console.log('[Custom] Upload success:', url);
    return { url, key };
  }

  async deleteFile(key) {
    console.warn('[Custom] deleteFile not implemented — 请在自定义服务端处理文件清理');
  }
}

module.exports = CustomProvider;
