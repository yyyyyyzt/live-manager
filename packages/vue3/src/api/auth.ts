/**
 * 认证 API - 从共享包重新导出
 */
import './client';

export {
  checkServerConfig,
  login,
  getUserSig,
  createBasicAccount,
  getUserProfilePortrait,
  batchGetUserProfilePortrait,
  CREDENTIAL_KEYS,
  saveCredentials,
  getCredentials,
  isLoggedIn,
  isProxyMode,
  clearCredentials,
  // URL 覆盖（简化版）
  getUrlOverrideParams,
  isUrlOverrideMode,
  createAccountFromUrlOverride,
  getUrlOverrideQuery,
  appendOverrideToPath,
  clearCache,
  setServerConfigured,
  isServerConfigured,
  // 凭证管理
  isServerConfiguredMode,
  getCurrentUserId,
  getCurrentUserSig,
} from '@live-manager/common';
export type {
  CheckConfigResponse,
  LoginParams,
  CredentialLoginParams,
  LoginResponse,
  UserSigResponse,
  StoredCredentials,
  UserPortraitProfile,
} from '@live-manager/common';
