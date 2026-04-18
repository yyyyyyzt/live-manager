const { Config } = require('../../../config/index.js');
const CosProvider = require('./CosProvider');
const CustomProvider = require('./CustomProvider');

/**
 * Provider 注册表
 *
 * 扩展新的 Provider 时，在此处注册即可：
 *   1. 创建 YourProvider.js 继承 StorageProvider
 *   2. 在下方 PROVIDER_MAP 中添加映射
 *   3. 在 .env 中设置 STORAGE_PROVIDER=your_key
 */
const PROVIDER_MAP = {
  cos: CosProvider,
  custom: CustomProvider,
};

/** @type {import('./StorageProvider')|null} */
let activeProvider = null;

/**
 * 获取当前活动的存储 Provider（单例）
 * @returns {import('./StorageProvider')|null}
 */
function getStorageProvider() {
  if (activeProvider) return activeProvider;

  // 只有明确配置了 STORAGE_PROVIDER 才启用存储，否则禁用（即使 cos 配置完整也不默认启用）
  const providerName = Config.StorageProvider ? Config.StorageProvider.toLowerCase() : '';
  if (!providerName) {
    console.log('[Storage] STORAGE_PROVIDER 未配置，存储功能禁用');
    return null;
  }

  // 自动检测：如果指定了 provider 名称，用对应实现
  const ProviderClass = PROVIDER_MAP[providerName];
  if (!ProviderClass) {
    console.warn(`[Storage] Unknown provider "${providerName}"`);
    return null;
  }

  activeProvider = new ProviderClass();

  if (activeProvider.isEnabled()) {
    console.log(`[Storage] Provider "${activeProvider.name}" is active`);
  } else {
    console.log(`[Storage] Provider "${activeProvider.name}" is NOT configured — upload disabled`);
  }

  return activeProvider;
}

/**
 * 检查上传功能是否可用
 */
function isUploadEnabled() {
  const provider = getStorageProvider();
  return provider ? provider.isEnabled() : false;
}

/**
 * 获取上传配置信息（供前端使用，不含密钥）
 */
function getUploadConfig() {
  const provider = getStorageProvider();
  if (!provider) {
    return { enabled: false, provider: 'none' };
  }
  return provider.getConfig();
}

/**
 * 生成存储 Key
 */
function generateKey(type, originalName) {
  const provider = getStorageProvider();
  if (!provider) throw new Error('Storage Provider 未配置');
  return provider.generateKey(type, originalName);
}

/**
 * 上传文件
 */
async function uploadFile(fileBuffer, key, contentType) {
  const provider = getStorageProvider();
  if (!provider || !provider.isEnabled()) {
    throw new Error('Storage Provider 未配置或未启用');
  }
  return provider.uploadFile(fileBuffer, key, contentType);
}

/**
 * 删除文件
 */
async function deleteFile(key) {
  const provider = getStorageProvider();
  if (!provider || !provider.isEnabled()) {
    throw new Error('Storage Provider 未配置或未启用');
  }
  return provider.deleteFile(key);
}

module.exports = {
  getStorageProvider,
  isUploadEnabled,
  getUploadConfig,
  generateKey,
  uploadFile,
  deleteFile,
  PROVIDER_MAP,
};
