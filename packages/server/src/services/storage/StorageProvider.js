const path = require('path');

/**
 * 存储 Provider 抽象基类
 *
 * 自定义存储服务只需继承此类并实现以下方法：
 * - isEnabled()       检查该 Provider 是否已正确配置
 * - getConfig()       返回配置信息（不含密钥，供前端使用）
 * - uploadFile()      上传文件，返回 { url, key }
 * - deleteFile()      删除已上传的文件（可选）
 *
 * 扩展步骤：
 * 1. 在 server/src/services/storage/ 下新建 YourProvider.js，继承 StorageProvider
 * 2. 在 server/src/services/storage/index.js 的 PROVIDER_MAP 中注册
 * 3. 在 .env 中设置 STORAGE_PROVIDER=your_provider_name 并填入对应配置
 */
class StorageProvider {
  /**
   * @param {string} name - Provider 名称标识，如 'cos', 'custom'
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * 检查 Provider 是否已正确配置并可用
   * @returns {boolean}
   */
  isEnabled() {
    throw new Error('StorageProvider.isEnabled() must be implemented');
  }

  /**
   * 获取前端可用的配置信息（不包含密钥等敏感信息）
   * @returns {{ enabled: boolean, provider: string, [key: string]: any }}
   */
  getConfig() {
    return {
      enabled: this.isEnabled(),
      provider: this.name,
    };
  }

  /**
   * 生成文件存储路径（Key）
   * 子类可覆写此方法自定义路径策略
   * @param {'cover' | 'gift-icon' | 'gift-animation'} type - 文件用途类型
   * @param {string} originalName - 原始文件名
   * @param {string} [pathPrefix] - 可选路径前缀
   * @returns {string} 存储 Key
   */
  generateKey(type, originalName, pathPrefix = '') {
    const ext = path.extname(originalName) || '.png';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirMap = {
      'cover': 'covers',
      'gift-icon': 'gifts/icons',
      'gift-animation': 'gifts/animations',
    };
    const subDir = dirMap[type] || 'uploads';
    const prefix = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/` : '';
    return `${prefix}${subDir}/${timestamp}_${random}${ext}`;
  }

  /**
   * 上传文件
   * @param {Buffer} fileBuffer - 文件二进制内容
   * @param {string} key - 存储路径 Key
   * @param {string} contentType - MIME 类型
   * @returns {Promise<{ url: string, key: string }>} 上传结果，包含访问 URL 和存储 Key
   */
  async uploadFile(fileBuffer, key, contentType) {
    throw new Error('StorageProvider.uploadFile() must be implemented');
  }

  /**
   * 删除已上传的文件（可选实现）
   * @param {string} key - 存储路径 Key
   * @returns {Promise<void>}
   */
  async deleteFile(key) {
    console.warn(`[${this.name}] deleteFile not implemented`);
  }
}

module.exports = StorageProvider;
