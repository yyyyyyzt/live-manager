const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

const parseSdkAppId = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const sdkAppId = parseSdkAppId(process.env.SDK_APP_ID ?? process.env.SdkAppId, 0)
const domain  = process.env.DOMAIN ?? process.env.Domain ?? (sdkAppId < 1400000000 ? 'adminapisgp.im.qcloud.com' : 'console.tim.qq.com')
console.log(`sdkAppId: ${sdkAppId}, domain: ${domain}`)
const Config = {
  SdkAppId: sdkAppId,
  SecretKey: process.env.SECRET_KEY ?? process.env.SDK_SECRET_KEY ?? process.env.SecretKey ?? '',
  Identifier: process.env.USER_ID ?? 'administrator',
  Protocol: 'https://',
  Domain: domain,
  Port: parseInt(process.env.PORT, 10) || 9000,
  // 存储 Provider 选择：'cos' | 'custom'（不配置则留空，禁用存储功能）
  StorageProvider: process.env.STORAGE_PROVIDER || '',
  // COS 配置（当 STORAGE_PROVIDER=cos 时使用）
  Cos: {
    SecretId: process.env.COS_SECRET_ID || '',
    SecretKey: process.env.COS_SECRET_KEY || '',
    Bucket: process.env.COS_BUCKET || '',
    Region: process.env.COS_REGION || '',
    CdnDomain: process.env.COS_CDN_DOMAIN || '',
    PathPrefix: process.env.COS_PATH_PREFIX || '',
  },
  // 自定义上传 Provider 配置（当 STORAGE_PROVIDER=custom 时使用）
  Custom: {
    UploadUrl: process.env.CUSTOM_UPLOAD_URL || '',
    AccessDomain: process.env.CUSTOM_ACCESS_DOMAIN || '',
    UploadField: process.env.CUSTOM_UPLOAD_FIELD || 'file',
    ResponseUrlField: process.env.CUSTOM_RESPONSE_URL_FIELD || 'data.url',
    AuthHeader: process.env.CUSTOM_AUTH_HEADER || '',
    PathPrefix: process.env.CUSTOM_PATH_PREFIX || '',
  },
};

module.exports = { Config };
