import type { BasicUserInfo } from '../types';
import LibGenerateTestUserSig from './lib-generate-test-usersig-es.min.ts';

/**
 * 官方 `lib-generate-test-usersig-es.min.ts` 在每次签名时会把
 * `SDKAPPID / PRIVATEKEY / userID / expire / ret` 打到浏览器控制台。
 * 在 URL 覆盖模式下前端会直接读到 SecretKey，一旦进 DevTools 就会泄露。
 * 这里临时静默 `console.log`，不改 min 源文件，方便后续整包升级。
 */
function silentSign<T>(fn: () => T): T {
  const original = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = original;
  }
}

export function getBasicInfo(
  userId: string,
  sdkAppId: number,
  sdkSecretKey: string,
  expireTime: number = 604800
): BasicUserInfo | undefined {
  if (sdkAppId === 0 || sdkSecretKey === '') {
    console.error('Please configure your sdkAppId in config/basic-info-config.js');
    return;
  }
  const generator = new LibGenerateTestUserSig(sdkAppId, sdkSecretKey, expireTime);
  const userSig = silentSign(() => generator.genTestUserSig(userId));
  return {
    sdkAppId: sdkAppId,
    userId: userId,
    userSig,
    userName: userId,
    avatarUrl: '',
  };
}
