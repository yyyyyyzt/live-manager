import { post, get } from './client';
import { TRTCApi, trtcRequest } from './trtc-client';
import { isUrlOverrideMode, createAccountFromUrlOverride, getUrlOverrideParams } from './url-override';
import type {
  BasicUserInfo,
  CheckConfigResponse,
  LoginParams,
  CredentialLoginParams,
  LoginResponse,
  UserSigResponse,
  StoredCredentials,
  UserPortraitProfile,
} from './types';

// ========== 配置检查 ==========
export async function checkServerConfig(): Promise<CheckConfigResponse> {
  return get<CheckConfigResponse>('/check_config');
}

// ========== 登录 ==========
export async function login(params: LoginParams | CredentialLoginParams): Promise<LoginResponse> {
  return post<LoginResponse>('/login', params);
}

// ========== UserSig ==========
export async function getUserSig(userId: string): Promise<UserSigResponse> {
  return post<UserSigResponse>('/get_user_sig', { userId });
}

/**
 * 通过服务端 API 创建基础账号信息（含 userSig）
 *
 * 如果 URL 中传了 sdkAppId + secretKey（URL 覆盖模式），
 * 则使用 LibGenerateTestUserSig 前端计算 userSig，不依赖服务端。
 *
 * @param userId 可选的用户 ID，不传则随机生成
 * @returns BasicUserInfo 或 undefined（失败时）
 */
export async function createBasicAccount(userId?: string): Promise<BasicUserInfo | undefined> {
  // URL 覆盖模式：使用前端 LibGenerateTestUserSig 生成 userSig
  if (isUrlOverrideMode()) {
    const account = createAccountFromUrlOverride(userId);
    if (account) {
      console.log('[createBasicAccount] Using URL override mode, sdkAppId:', account.sdkAppId);
      return account;
    }
    console.warn('[createBasicAccount] URL override mode active but failed to generate account');
  }

  const uid = userId || `live_${Math.ceil(Math.random() * 10000000)}`;
  try {
    const res = await getUserSig(uid);
    if (res.code === 0 && res.data) {
      return {
        sdkAppId: res.data.sdkAppId,
        userId: res.data.userId,
        userSig: res.data.userSig,
        userName: res.data.userName || uid,
        avatarUrl: '',
      };
    }
    console.error('[createBasicAccount] Server returned error:', res.message);
    return undefined;
  } catch (e: any) {
    console.error('[createBasicAccount] Request failed:', e.message);
    return undefined;
  }
}

const PROFILE_NICK_TAG = 'Tag_Profile_IM_Nick';
const PROFILE_AVATAR_TAG = 'Tag_Profile_IM_Image';

interface PortraitGetResponse {
  ErrorCode: number;
  ErrorInfo?: string;
  UserProfileItem?: Array<{
    To_Account: string;
    ResultCode?: number;
    ResultInfo?: string;
    ProfileItem?: Array<{
      Tag: string;
      Value: string;
    }>;
  }>;
}

function getProfileItemValue(
  items: Array<{ Tag: string; Value: string }> | undefined,
  tag: string
): string {
  return items?.find((item) => item.Tag === tag)?.Value || '';
}

/**
 * 通过腾讯云 portrait_get 接口拉取用户昵称和头像
 */
export async function getUserProfilePortrait(userId: string): Promise<UserPortraitProfile | null> {
  const targetUserId = userId.trim();
  if (!targetUserId) return null;

  const response = await trtcRequest<PortraitGetResponse>(TRTCApi.getUserProfilePortrait, {
    To_Account: [targetUserId],
    TagList: [PROFILE_NICK_TAG, PROFILE_AVATAR_TAG],
  });

  if (response.ErrorCode !== 0) {
    throw new Error(response.ErrorInfo || '拉取用户资料失败');
  }

  const profile = response.UserProfileItem?.find((item) => item.To_Account === targetUserId);
  if (!profile || (profile.ResultCode !== undefined && profile.ResultCode !== 0)) {
    return {
      userId: targetUserId,
      nick: '',
      avatarUrl: '',
    };
  }

  return {
    userId: targetUserId,
    nick: getProfileItemValue(profile.ProfileItem, PROFILE_NICK_TAG),
    avatarUrl: getProfileItemValue(profile.ProfileItem, PROFILE_AVATAR_TAG),
  };
}

/**
 * 批量获取用户资料（昵称和头像）
 * 注意：每次最多支持100个用户
 * @param userIds 用户ID数组
 * @returns 用户资料Map，key为userId
 */
export async function batchGetUserProfilePortrait(
  userIds: string[]
): Promise<Map<string, UserPortraitProfile>> {
  const result = new Map<string, UserPortraitProfile>();

  // 过滤空值并去重
  const validUserIds = Array.from(new Set(userIds.map(id => id.trim()).filter(Boolean)));
  if (validUserIds.length === 0) return result;

  // 分批处理，每批最多100个
  const BATCH_SIZE = 100;
  const batches: string[][] = [];

  for (let i = 0; i < validUserIds.length; i += BATCH_SIZE) {
    batches.push(validUserIds.slice(i, i + BATCH_SIZE));
  }

  // 并行请求所有批次
  const responses = await Promise.all(
    batches.map(batch =>
      trtcRequest<PortraitGetResponse>(TRTCApi.getUserProfilePortrait, {
        To_Account: batch,
        TagList: [PROFILE_NICK_TAG, PROFILE_AVATAR_TAG],
      })
    )
  );

  // 汇总结果
  for (const response of responses) {
    if (response.ErrorCode !== 0) {
      // API error，跳过此批次
      continue;
    }

    for (const profile of response.UserProfileItem || []) {
      const userId = profile.To_Account;

      // 如果该用户请求失败，记录空资料
      if (profile.ResultCode !== undefined && profile.ResultCode !== 0) {
        result.set(userId, { userId, nick: '', avatarUrl: '' });
        continue;
      }

      result.set(userId, {
        userId,
        nick: getProfileItemValue(profile.ProfileItem, PROFILE_NICK_TAG),
        avatarUrl: getProfileItemValue(profile.ProfileItem, PROFILE_AVATAR_TAG),
      });
    }
  }

  return result;
}

// ========== 凭证管理 ==========

// sessionStorage keys（凭证模式使用，会话级存储）
const SS_CREDENTIALS = 'session_credentials';

const CREDENTIAL_KEYS = {
  CONFIGURED: 'server_configured',
} as const;

export { CREDENTIAL_KEYS };

/** 会话凭证（用于凭证模式） */
interface SessionCredentials {
  userId: string;
  userSig: string;
  sdkAppId: number;
}

/**
 * 保存登录状态（不保存敏感凭证到 localStorage）
 *
 * - 服务端配置模式：只保存 server_configured=true
 * - URL 覆盖模式：不保存任何内容
 * - 凭证模式：保存到 sessionStorage（会话级）
 */
export function saveCredentials(data: LoginResponse['data']): void {
  if (!data) return;

  if (data.configured) {
    // 服务端配置模式：只保存标记
    localStorage.setItem(CREDENTIAL_KEYS.CONFIGURED, 'true');
  } else {
    // 凭证模式或 URL 覆盖模式：保存到 sessionStorage
    localStorage.setItem(CREDENTIAL_KEYS.CONFIGURED, 'false');
    const creds: SessionCredentials = {
      userId: data.userId ?? '',
      userSig: data.userSig ?? '',
      sdkAppId: data.sdkAppId ?? 0,
    };
    sessionStorage.setItem(SS_CREDENTIALS, JSON.stringify(creds));
  }
}

/**
 * 获取当前凭证
 *
 * 优先级：
 * 1. URL 覆盖模式 → 从 URL 参数解析
 * 2. 服务端配置模式 → 需要调用 login API 获取
 * 3. 凭证模式 → 从 sessionStorage 读取
 */
export function getCredentials(): SessionCredentials | null {
  // 1. URL 覆盖模式：从 URL 解析
  if (isUrlOverrideMode()) {
    const account = createAccountFromUrlOverride();
    if (account) {
      return {
        userId: account.userId,
        userSig: account.userSig,
        sdkAppId: account.sdkAppId,
      };
    }
  }

  // 2. 服务端配置模式：需要调用 API，这里返回 null
  //    MainLayout 会调用 login({}) 获取
  if (localStorage.getItem(CREDENTIAL_KEYS.CONFIGURED) === 'true') {
    return null; // 需要调用 API
  }

  // 3. 凭证模式：从 sessionStorage 读取
  const stored = sessionStorage.getItem(SS_CREDENTIALS);
  if (stored) {
    try {
      return JSON.parse(stored) as SessionCredentials;
    } catch {
      return null;
    }
  }

  return null;
}

/** 判断是否为服务端配置模式 */
export function isServerConfiguredMode(): boolean {
  return localStorage.getItem(CREDENTIAL_KEYS.CONFIGURED) === 'true';
}

/** 判断是否已登录 */
export function isLoggedIn(): boolean {
  // URL 覆盖模式：始终视为已登录
  if (isUrlOverrideMode()) return true;

  // 服务端配置模式：检查标记
  if (isServerConfiguredMode()) return true;

  // 凭证模式：检查 sessionStorage
  return !!sessionStorage.getItem(SS_CREDENTIALS);
}

/** 判断 server 是否未配置（凭证透传模式） */
export function isProxyMode(): boolean {
  return localStorage.getItem(CREDENTIAL_KEYS.CONFIGURED) === 'false';
}

/** 清除所有登录凭证 */
export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIAL_KEYS.CONFIGURED);
  sessionStorage.removeItem(SS_CREDENTIALS);
  // 兼容旧版本清理
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_sig');
  localStorage.removeItem('sdk_app_id');
}

// ========== SDK 凭证获取 ==========

/**
 * 获取当前 SDK App ID
 * 优先从 URL 参数读取，否则从凭证中获取
 */
export function getSdkAppId(): number {
  const override = getUrlOverrideParams();
  if (override) {
    return override.sdkAppId;
  }
  const creds = getCredentials();
  return creds?.sdkAppId || 0;
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(): string {
  const creds = getCredentials();
  return creds?.userId || '';
}

/**
 * 获取当前 UserSig
 */
export function getCurrentUserSig(): string {
  const creds = getCredentials();
  return creds?.userSig || '';
}
