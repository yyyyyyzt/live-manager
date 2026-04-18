const COS = require('cos-nodejs-sdk-v5');
const StorageProvider = require('./StorageProvider');
const { Config } = require('../../../config/index.js');

/**
 * 腾讯云 COS 存储 Provider
 *
 * 所需 .env 配置：
 *   COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION
 *   COS_CDN_DOMAIN (可选，自定义 CDN 加速域名)
 *   COS_PATH_PREFIX (可选，存储路径前缀)
 */
class CosProvider extends StorageProvider {
  constructor() {
    super('cos');
    this._instance = null;
  }

  /** @returns {COS|null} */
  _getCosInstance() {
    if (this._instance) return this._instance;
    const { SecretId, SecretKey } = Config.Cos;
    if (!SecretId || !SecretKey) return null;
    this._instance = new COS({ SecretId, SecretKey });
    return this._instance;
  }

  isEnabled() {
    const { SecretId, SecretKey, Bucket, Region } = Config.Cos;
    return !!(SecretId && SecretKey && Bucket && Region);
  }

  getConfig() {
    return {
      ...super.getConfig(),
      bucket: Config.Cos.Bucket,
      region: Config.Cos.Region,
      cdnDomain: Config.Cos.CdnDomain,
    };
  }

  /**
   * 生成 COS Key（带可选路径前缀）
   */
  generateKey(type, originalName) {
    return super.generateKey(type, originalName, Config.Cos.PathPrefix);
  }

  /**
   * 构造访问 URL
   */
  _buildAccessUrl(key) {
    const { Bucket, Region, CdnDomain } = Config.Cos;
    if (CdnDomain) {
      const domain = CdnDomain.replace(/\/+$/, '');
      return `${domain}/${key}`;
    }
    return `https://${Bucket}.cos.${Region}.myqcloud.com/${key}`;
  }

  uploadFile(fileBuffer, key, contentType) {
    return new Promise((resolve, reject) => {
      const cos = this._getCosInstance();
      if (!cos) return reject(new Error('COS 未配置'));

      const { Bucket, Region } = Config.Cos;
      cos.putObject({
        Bucket,
        Region,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      }, (err) => {
        if (err) {
          console.error('[COS] Upload failed:', err);
          return reject(err);
        }
        const url = this._buildAccessUrl(key);
        console.log('[COS] Upload success:', url);
        resolve({ url, key });
      });
    });
  }

  deleteFile(key) {
    return new Promise((resolve, reject) => {
      const cos = this._getCosInstance();
      if (!cos) return reject(new Error('COS 未配置'));

      const { Bucket, Region } = Config.Cos;
      cos.deleteObject({ Bucket, Region, Key: key }, (err, data) => {
        if (err) {
          console.error('[COS] Delete failed:', err);
          return reject(err);
        }
        resolve(data);
      });
    });
  }
}

module.exports = CosProvider;
