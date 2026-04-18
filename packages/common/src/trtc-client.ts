/**
 * TRTC REST API 客户端（共享）
 *
 * 架构说明：
 * - 前端掌控全部业务逻辑（参数组装、数据映射、缓存）
 * - 通过 server 的 /api/trtc_proxy 端点中转请求（解决 CORS + 凭证安全）
 * - server 仅负责拼接凭证 + HTTP 转发，无业务逻辑
 */
import { post } from './client';
import type { UserSigResponse } from './types';

// ========== TRTC API 接口路径 ==========
export const TRTCApi = {
  // 房间管理
  createRoom: 'v4/live_engine_http_srv/create_room',
  destroyRoom: 'v4/live_engine_http_srv/destroy_room',
  fetchLiveList: 'v4/live_engine_http_srv/get_room_list',
  getRoomInfo: 'v4/live_engine_http_srv/get_room_info',
  updateRoomInfo: 'v4/live_engine_http_srv/update_room_info',
  // 房间自定义信息
  getRoomMetadata: 'v4/live_engine_http_srv/get_room_metadata',
  setRoomMetadata: 'v4/live_engine_http_srv/set_room_metadata',
  delRoomMetadata: 'v4/live_engine_http_srv/del_room_metadata',
  // 消息
  sendTextMsg: 'v4/live_engine_http_srv/send_text_msg',
  sendCustomMsg: 'v4/live_engine_http_srv/send_custom_msg',
  // 成员管理
  muteMember: 'v4/live_engine_http_srv/mute_member',
  banMember: 'v4/live_engine_http_srv/ban_member',
  unbanMember: 'v4/live_engine_http_srv/unban_member',
  getBannedMemberList: 'v4/live_engine_http_srv/get_banned_member_list',
  getMutedMemberList: 'v4/live_engine_http_srv/get_muted_member_list',
  // 房间统计
  getRoomStatistic: 'v4/live_engine_http_srv/get_room_statistic',
  // 礼物管理
  getGiftList: 'v4/live_engine_http_srv/get_gift_info_list',
  getGift: 'v4/live_engine_http_srv/get_gift',
  addGift: 'v4/live_engine_http_srv/add_gift',
  editGift: 'v4/live_engine_http_srv/edit_gift',
  delGift: 'v4/live_engine_http_srv/del_gift',
  getGiftCount: 'v4/live_engine_http_srv/get_gift_count',
  getGiftLanguage: 'v4/live_engine_http_srv/get_gift_language',
  setGiftLanguage: 'v4/live_engine_http_srv/set_gift_language',
  delGiftLanguage: 'v4/live_engine_http_srv/del_gift_language',
  // 礼物分类
  addGiftCategory: 'v4/live_engine_http_srv/add_gift_category',
  delGiftCategory: 'v4/live_engine_http_srv/del_gift_category',
  getGiftCategory: 'v4/live_engine_http_srv/get_gift_category',
  editGiftCategory: 'v4/live_engine_http_srv/edit_gift_category',
  getGiftCategoryLanguage: 'v4/live_engine_http_srv/get_gift_category_language',
  setGiftCategoryLanguage: 'v4/live_engine_http_srv/set_gift_category_language',
  delGiftCategoryLanguage: 'v4/live_engine_http_srv/del_gift_category_language',
  addGiftCategoryRelations: 'v4/live_engine_http_srv/add_gift_category_relations',
  delGiftCategoryRelations: 'v4/live_engine_http_srv/del_gift_category_relations',
  // 机器人 & 麦位
  addRobot: 'v4/live_engine_http_srv/add_robot',
  getRobot: 'v4/live_engine_http_srv/get_robot',
  delRobot: 'v4/live_engine_http_srv/del_robot',
  // 账号导入（IM API，用于创建机器人前先将账号导入 IM 账号系统）
  importAccount: 'v4/im_open_login_svc/account_import',
  getSeatList: 'v4/room_engine_http_mic/get_seat_list',
  pickUserOnSeat: 'v4/room_engine_http_mic/pick_user_on_seat',
  kickUserOffSeat: 'v4/room_engine_http_mic/kick_user_off_seat',
  // 混流
  resumeMcuTask: 'v4/live_engine_http_srv/resume_mcu_task',
  // 用户资料
  getUserProfilePortrait: 'v4/profile/portrait_get',
} as const;

/**
 * 通过 server 代理发送 TRTC API 请求
 */
export async function trtcRequest<T = any>(
  apiPath: string,
  body: Record<string, any> = {}
): Promise<T> {
  const apiName = apiPath.split('/').pop() || '';
  console.log(`[TRTC] ${apiName}`, body);

  // domain 完全由服务器端根据 sdkAppId 决定，前端不传递
  return post<T>('/trtc_proxy', { apiPath, body });
}

/**
 * TRTC 响应通用接口
 */
export interface TRTCResponse<T = any> {
  ErrorCode: number;
  ErrorInfo?: string;
  ActionStatus?: string;
  RequestId?: string;
  Response?: T;
}

/**
 * 检查 TRTC 响应是否成功
 */
export function checkTRTCResponse<T>(response: TRTCResponse<T>, errorPrefix = 'TRTC API'): T | undefined {
  if (response.ErrorCode !== 0) {
    throw new Error(`${errorPrefix}: ${response.ErrorInfo || 'Unknown error'} (code: ${response.ErrorCode})`);
  }
  return response.Response;
}

// ========== 推流地址生成 ==========

/**
 * 判断是否为海外版 SDK App ID
 * sdkAppId < 1400000000 为海外版
 */
export function isOverseaSdkAppId(sdkAppId: number): boolean {
  return sdkAppId < 1400000000;
}

/**
 * 获取 RTMP 推流服务器地址
 */
export function getRtmpPushUrl(sdkAppId?: number): string {
  const appId = sdkAppId || getSdkAppId();
  return isOverseaSdkAppId(appId)
    ? 'rtmp://intl-rtmp.rtc.qq.com/push'
    : 'rtmp://rtmp.rtc.qq.com/push';
}

/**
 * 推流信息
 */
export interface PushInfo {
  /** RTMP 服务器地址 */
  ServerUrl: string;
  /** 推流密钥（包含 roomId、sdkAppId、userId、userSig） */
  StreamKey: string;
}

/**
 * 为指定用户获取 UserSig（通过服务端生成）
 * @param userId 目标用户 ID
 * @returns userSig 字符串，失败返回 null
 */
async function fetchUserSig(userId: string): Promise<string | null> {
  try {
    const res = await post<UserSigResponse>('/get_user_sig', { userId });
    if (res.code === 0 && res.data?.userSig) {
      return res.data.userSig;
    }
    console.warn('[fetchUserSig] Server returned error:', res.message);
    return null;
  } catch (e: any) {
    console.warn('[fetchUserSig] Request failed:', e.message);
    return null;
  }
}

/**
 * 生成推流信息（同步版本，仅当 userId 与当前登录用户一致时可用）
 * @param roomId 房间 ID
 * @param anchorId 主播 ID（默认使用当前用户）
 * @deprecated 推荐使用 getStreamInfoAsync，可正确处理 anchorId 与当前用户不一致的场景
 */
export function getStreamInfo(roomId: string, anchorId?: string): PushInfo | null {
  const sdkAppId = getSdkAppId();
  const userId = anchorId || getCurrentUserId();
  const userSig = getCurrentUserSig();

  if (!sdkAppId || !userId || !userSig) {
    console.warn('[getStreamInfo] Missing credentials:', { sdkAppId, userId, userSig: !!userSig });
    return null;
  }

  if (anchorId && anchorId !== getCurrentUserId()) {
    console.warn('[getStreamInfo] anchorId 与当前用户不一致，同步版本无法获取匹配的 userSig，请使用 getStreamInfoAsync');
  }

  return {
    ServerUrl: getRtmpPushUrl(sdkAppId),
    StreamKey: `${roomId}?sdkappid=${sdkAppId}&userid=${userId}&usersig=${userSig}`,
  };
}

/**
 * 生成推流信息（异步版本）
 * 当 anchorId 与当前登录用户不同时，会向服务端请求为主播生成配套的 UserSig
 * @param roomId 房间 ID
 * @param anchorId 主播 ID（默认使用当前用户）
 */
export async function getStreamInfoAsync(roomId: string, anchorId?: string): Promise<PushInfo | null> {
  const sdkAppId = getSdkAppId();
  const currentUserId = getCurrentUserId();
  const userId = anchorId || currentUserId;

  if (!sdkAppId || !userId) {
    console.warn('[getStreamInfoAsync] Missing credentials:', { sdkAppId, userId });
    return null;
  }

  let userSig: string;

  if (!anchorId || anchorId === currentUserId) {
    // 主播就是当前登录用户，直接使用 localStorage 中的 userSig
    userSig = getCurrentUserSig();
  } else {
    // 主播与当前用户不同，需要为主播单独生成 userSig
    console.log(`[getStreamInfoAsync] anchorId(${anchorId}) !== currentUser(${currentUserId}), fetching userSig from server`);
    const fetchedSig = await fetchUserSig(anchorId);
    if (!fetchedSig) {
      console.warn('[getStreamInfoAsync] Failed to fetch userSig for anchor:', anchorId);
      return null;
    }
    userSig = fetchedSig;
  }

  if (!userSig) {
    console.warn('[getStreamInfoAsync] userSig is empty');
    return null;
  }

  return {
    ServerUrl: getRtmpPushUrl(sdkAppId),
    StreamKey: `${roomId}?sdkappid=${sdkAppId}&userid=${userId}&usersig=${userSig}`,
  };
}
