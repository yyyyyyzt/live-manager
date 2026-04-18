/**
 * URL 参数覆盖模块（简化版）
 *
 * 支持通过 URL 的 query 参数 sdkAppId + secretKey 覆盖从后台获取的凭证。
 * 每次都从 URL 参数解析，不缓存任何凭证信息。
 */
import { getBasicInfo } from './config';
import type { BasicUserInfo } from './types';

// sessionStorage keys
const SS_SERVER_CONFIGURED = 'server_configured';

export interface UrlOverrideParams {
  sdkAppId: number;
  secretKey: string;
}

/**
 * 从当前页面 URL（hash 模式）中解析 sdkAppId & secretKey 参数。
 * 支持两种格式：
 *   - hash query:  /#/room-list?sdkAppId=xxx&secretKey=yyy
 *   - normal query: /?sdkAppId=xxx&secretKey=yyy#/room-list
 */
export function getUrlOverrideParams(): UrlOverrideParams | null {
  let sdkAppIdStr = '';
  let secretKey = '';

  // 1. 从 hash 中的 query 参数读取（hash 路由模式 /#/path?key=val）
  const hash = window.location.hash;
  if (hash) {
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      const hashParams = new URLSearchParams(hash.substring(qIdx + 1));
      if (!sdkAppIdStr) sdkAppIdStr = hashParams.get('sdkAppId') || '';
      if (!secretKey) secretKey = hashParams.get('secretKey') || '';
    }
  }

  // 2. 从 window.location.search 读取（普通 query 参数）
  const searchParams = new URLSearchParams(window.location.search);
  if (!sdkAppIdStr) sdkAppIdStr = searchParams.get('sdkAppId') || '';
  if (!secretKey) secretKey = searchParams.get('secretKey') || '';

  const sdkAppId = Number(sdkAppIdStr);
  if (sdkAppId > 0 && secretKey) {
    return { sdkAppId, secretKey };
  }
  return null;
}

/**
 * 判断当前是否处于 URL 覆盖模式
 */
export function isUrlOverrideMode(): boolean {
  return getUrlOverrideParams() !== null;
}

/**
 * 使用 URL 覆盖参数在前端生成 BasicUserInfo（含 userSig）。
 * 每次都重新计算 userSig，userId 默认随机生成。
 */
export function createAccountFromUrlOverride(userId?: string): BasicUserInfo | undefined {
  const override = getUrlOverrideParams();
  if (!override) return undefined;

  const uid = userId || `live_${Math.ceil(Math.random() * 10000000)}`;
  return getBasicInfo(uid, override.sdkAppId, override.secretKey);
}

/**
 * 设置服务器是否已配置
 */
export function setServerConfigured(configured: boolean): void {
  sessionStorage.setItem(SS_SERVER_CONFIGURED, configured ? 'true' : 'false');
}

/**
 * 检查服务器是否已配置
 */
export function isServerConfigured(): boolean {
  return sessionStorage.getItem(SS_SERVER_CONFIGURED) === 'true';
}

/**
 * 获取需要附加到 URL 上的覆盖参数查询字符串。
 * 页面跳转时调用，保证参数不丢失。
 */
export function getUrlOverrideQuery(): string {
  const override = getUrlOverrideParams();
  if (!override) return '';
  return `sdkAppId=${override.sdkAppId}&secretKey=${encodeURIComponent(override.secretKey)}`;
}

/**
 * 给路由路径附加 URL 覆盖参数。
 */
export function appendOverrideToPath(path: string): string {
  const query = getUrlOverrideQuery();
  if (!query) return path;

  const [basePath, existingQuery] = path.split('?');
  if (existingQuery) {
    return `${basePath}?${existingQuery}&${query}`;
  }
  return `${basePath}?${query}`;
}

/**
 * 根据 sdkAppId 计算对应的 Domain
 * sdkAppId < 1400000000 为海外版
 */
export function computeDomain(sdkAppId: number): string {
  return sdkAppId < 1400000000
    ? 'adminapisgp.im.qcloud.com'
    : 'console.tim.qq.com';
}

/**
 * 清除缓存（退出登录时调用）
 */
export function clearCache(): void {
  sessionStorage.removeItem(SS_SERVER_CONFIGURED);
}
