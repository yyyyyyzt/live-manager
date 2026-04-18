const { Config } = require('../../config/index.js');
const LibGenerateTestUserSig = require('./lib-generate-test-usersig-es.min.js');

const { SdkAppId, SecretKey, Identifier } = Config;

const userInfo = {
  UserId: Identifier,
  UserName: `Admin_${Identifier}`,
  AvatarUrl: '',
};

function getBasicInfo() {
  if (SdkAppId === 0 || SecretKey === '') {
    console.log('Please configure your SdkAppId in config/index.js.js');
    return;
  }
  const generator = new LibGenerateTestUserSig(SdkAppId, SecretKey, 604800);
  const UserSig = generator.genTestUserSig(userInfo.UserId) || '';
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
  const UserSig = generator.genTestUserSig(userId) || '';
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
    const userSig = generator.genTestUserSig(userId) || '';
    return userSig || null;
  } catch (e) {
    console.error('[generateUserSigWithKey] Failed:', e.message);
    return null;
  }
}

module.exports = { getBasicInfo, getUserSig, generateUserSigWithKey };
