const { Config } = require('../../config/index.js');
const LibGenerateTestUserSig = require('./lib-generate-test-usersig-es.min.js');

const { SdkAppId, SecretKey, Identifier } = Config;

const userInfo = {
  UserId: Identifier,
  UserName: `Admin_${Identifier}`,
  AvatarUrl: '',
};

/**
 * 官方 `lib-generate-test-usersig-es.min.js` 在每次 `genTestUserSig` 时会向
 * 控制台打印：
 *   sdkAppID=<id> key=<SECRET_KEY> userID=<uid> expire=...
 *   ret=<userSig>
 *   validate ret=<bool>
 * 这会把 `SECRET_KEY` 原文泄露到进程 stdout 与日志采集。此处用临时静默
 * `console.log` 的方式消除该副作用（不修改 min 源文件，便于后续升级替换）。
 */
function silentSign(generate) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return generate();
  } finally {
    console.log = originalLog;
  }
}

function getBasicInfo() {
  if (SdkAppId === 0 || SecretKey === '') {
    console.log('Please configure your SdkAppId in config/index.js.js');
    return;
  }
  const generator = new LibGenerateTestUserSig(SdkAppId, SecretKey, 604800);
  const UserSig = silentSign(() => generator.genTestUserSig(userInfo.UserId)) || '';
  const { UserId, UserName, AvatarUrl } = userInfo;
  return {
    SdkAppId,
    UserId,
    UserSig,
    UserName,
    AvatarUrl,
  };
}

function getUserSig(userId) {
  if (SdkAppId === 0 || SecretKey === '') {
    console.log('Please configure your SdkAppId in config/index.js.js');
    return;
  }
  const generator = new LibGenerateTestUserSig(SdkAppId, SecretKey, 604800);
  const UserSig = silentSign(() => generator.genTestUserSig(userId)) || '';
  return {
    SdkAppId,
    UserId: userId,
    UserSig,
    UserName: userId,
    AvatarUrl: '',
  };
}

/**
 * 使用自定义的 sdkAppId + secretKey 生成 UserSig
 * 用于 URL 覆盖模式：前端传来不同于 server 配置的凭证
 */
function generateUserSigWithKey(sdkAppId, secretKey, userId) {
  if (!sdkAppId || !secretKey || !userId) return null;
  try {
    const generator = new LibGenerateTestUserSig(Number(sdkAppId), secretKey, 604800);
    const userSig = silentSign(() => generator.genTestUserSig(userId)) || '';
    return userSig || null;
  } catch (e) {
    console.error('[generateUserSigWithKey] Failed:', e.message);
    return null;
  }
}

module.exports = { getBasicInfo, getUserSig, generateUserSigWithKey };
