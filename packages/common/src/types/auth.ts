// 配置检查响应
export interface CheckConfigResponse {
  code: number;
  message: string;
  data?: {
    configured: boolean;
    sdkAppId: number;
    hasSdkAppId: boolean;
    hasSecretKey: boolean;
    hasIdentifier: boolean;
    identifier: string;
  };
}

// 登录参数（自动模式 - 服务器完整配置时不需要参数）
export interface AutoLoginParams {
  // 服务器完整配置时不需要任何参数
}

// 登录参数（URL override 模式 - 前端通过 URL 传入 sdkAppId + secretKey）
export interface UrlOverrideLoginParams {
  sdkAppId: number;
  secretKey: string;
  userId?: string;
}

// 登录参数（凭证模式 - 服务器未完整配置时需要）
export interface CredentialLoginParams {
  userId?: string;
  userSig: string;
  sdkAppId: number;
  domain?: string;
}

// 统一登录参数类型
export type LoginParams = AutoLoginParams | UrlOverrideLoginParams | CredentialLoginParams;

// 登录响应
export interface LoginResponse {
  code: number;
  message: string;
  data?: {
    token: string;
    userId: string;
    userName: string;
    sdkAppId?: number;
    userSig?: string;
    configured?: boolean;
    domain?: string;
  };
}

// UserSig 响应
export interface UserSigResponse {
  code: number;
  message: string;
  data?: {
    sdkAppId: number;
    userId: string;
    userSig: string;
    userName: string;
  };
}

// 存储的凭证
export interface StoredCredentials {
  userId: string;
  userSig: string;
  sdkAppId: number;
}

// 基础用户信息
export interface BasicUserInfo {
  sdkAppId: number;
  userId: string;
  userSig: string;
  userName: string;
  avatarUrl: string;
}

// IM 用户资料（通过 portrait_get 拉取）
export interface UserPortraitProfile {
  userId: string;
  nick: string;
  avatarUrl: string;
}
