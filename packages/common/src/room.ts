import { post } from './client';
import { trtcRequest, TRTCApi, getStreamInfoAsync } from './trtc-client';
import { sendCustomMessage } from './chat';
import type {
  CreateRoomResponse,
  GetLiveListResponse,
  StartObsLiveResponse,
  GetRobotResponse,
  GetSeatListResponse,
  SeatItem,
} from './types';

// 字段映射
function mapRoomInfo(roomInfo: any) {
  roomInfo.IsLikeEnabled = roomInfo.IsThumbsEnabled !== undefined ? roomInfo.IsThumbsEnabled : true;
  roomInfo.Category = roomInfo.Tags || [];
  roomInfo.IsPublicVisible = roomInfo.IsPublicVisibled !== undefined ? roomInfo.IsPublicVisibled : true;
  roomInfo.LikeCount = roomInfo.LikeCount || 0;
  roomInfo.GiftCount = roomInfo.GiftCount || 0;
  roomInfo.GiftAmount = roomInfo.GiftAmount || 0;
  roomInfo.CommentCount = roomInfo.CommentCount || 0;
  roomInfo.MemberCount = roomInfo.MemberCount || 0;
  // 映射 Owner_Account 到 roomOwner 和 ownerName，供 SDK 使用
  roomInfo.roomOwner = roomInfo.roomOwner || roomInfo.Owner_Account || '';
  roomInfo.ownerName = roomInfo.ownerName || roomInfo.Owner_Account || '';
  roomInfo.ownerAvatarUrl = roomInfo.ownerAvatarUrl || '';
  return roomInfo;
}

// 获取直播间列表
export async function getRoomList(params: { next?: string; count?: number; sortDirection?: 'descend' | 'ascend' } = {}): Promise<GetLiveListResponse> {
  const safeNext = params.next || '0';
  const safeCount = params.count || 20;

  const response = await trtcRequest<GetLiveListResponse>(TRTCApi.fetchLiveList, {
    Next: safeNext,
    Count: safeCount,
    SortDirection: params.sortDirection,
  });

  if (response.Response?.RoomList) {
    response.Response.RoomList.forEach((roomInfo: any) => {
      if (roomInfo.RoomId) {
        mapRoomInfo(roomInfo);
      }
    });
  }

  return response;
}

// 获取直播间详情
export async function getRoomDetail(roomId: string): Promise<any> {
  console.log(`[RoomDetail] Fetching latest room info for ${roomId}`);
  const [roomInfoRes, metadataRes] = await Promise.all([
    trtcRequest(TRTCApi.getRoomInfo, { RoomId: roomId }),
    trtcRequest(TRTCApi.getRoomMetadata, { RoomId: roomId, Keys: [] }),
  ]);

  if (roomInfoRes.Response?.RoomInfo) {
    const roomInfo = roomInfoRes.Response.RoomInfo;
    mapRoomInfo(roomInfo);
    if (metadataRes?.Response?.Metadata) {
      roomInfo.CustomInfo = {} as Record<string, string>;
      metadataRes.Response.Metadata.forEach((item: { Key: string; Value: string }) => {
        roomInfo.CustomInfo[item.Key] = item.Value;
      });
    }
  }

  return roomInfoRes;
}

// 获取直播间统计
export async function getRoomStats(roomId: string): Promise<any> {
  try {
    const roomInfoRes = await trtcRequest(TRTCApi.getRoomInfo, { RoomId: roomId });
    const ownerAccount = roomInfoRes?.Response?.RoomInfo?.Owner_Account;

    let giftCount = null;
    if (ownerAccount) {
      try {
        giftCount = await trtcRequest(TRTCApi.getGiftCount, { RoomId: roomId, From_Account: ownerAccount });
      } catch (e) {
        console.error('Failed to get gift count:', e);
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        roomId,
        onlineCount: roomInfoRes?.Response?.RoomInfo?.OnlineCount || 0,
        likeCount: roomInfoRes?.Response?.RoomInfo?.LikeCount || 0,
        commentCount: roomInfoRes?.Response?.RoomInfo?.CommentCount || 0,
        giftCount: giftCount?.Response?.TotalCount || 0,
        giftAmount: giftCount?.Response?.TotalCoins || 0,
        giftUserCount: giftCount?.Response?.GiftSenderCount || 0,
      },
    };
  } catch (error: any) {
    return { code: -1, message: error?.message || 'get_room_stats failed' };
  }
}

// 获取房间统计数据（新版接口）
export interface RoomStatisticResponse {
  ErrorCode: number;
  ErrorInfo: string;
  ActionStatus: string;
  RequestId: string;
  Response: {
    TotalViewers: number;
    TotalGiftsSent: number;
    TotalGiftCoins: number;
    TotalUniqueGiftSenders: number;
    TotalLikesReceived: number;
    TotalMsgCount: number;
  };
}

export async function getRoomStatistic(roomId: string): Promise<RoomStatisticResponse> {
  return trtcRequest<RoomStatisticResponse>(TRTCApi.getRoomStatistic, { RoomId: roomId });
}

// 获取礼物统计
export async function getGiftStats(roomId: string, fromAccount: string, startTime?: number, endTime?: number): Promise<any> {
  const body: any = { RoomId: roomId, From_Account: fromAccount };
  if (startTime) body.StartTime = startTime;
  if (endTime) body.EndTime = endTime;
  return trtcRequest(TRTCApi.getGiftCount, body);
}

// 关闭直播间
export async function closeRoom(roomId: string): Promise<any> {
  return trtcRequest(TRTCApi.destroyRoom, { RoomId: roomId });
}

// 封禁直播间
export async function banRoom(roomId: string): Promise<any> {
  return trtcRequest(TRTCApi.destroyRoom, { RoomId: roomId });
}

// 创建直播间
export async function createRoom(params: {
  roomId: string;
  anchorId: string;
  title?: string;
  coverUrl?: string;
  seatTemplate?: string;
  maxSeatCount?: number;
  customInfo?: Record<string, string>;
  useObsStreaming?: boolean;
}): Promise<CreateRoomResponse> {
  const roomInfo: any = {
    RoomId: params.roomId,
    RoomType: 'Live',
    SeatTemplate: params.seatTemplate || 'VideoDynamicGrid9Seats',
    Owner_Account: params.anchorId,
    IsUnlimitedRoomEnabled: true
  };

  // OBS 推流模式下，房主不自动上麦（由机器人代替）
  if (params.useObsStreaming) {
    roomInfo.KeepOwnerOnSeat = false;
  }

  // 只有在标题有值时才设置，让服务器处理空标题
  if (params.title && params.title.trim()) {
    roomInfo.RoomName = params.title;
  }

  // 设置封面 URL
  if (params.coverUrl && params.coverUrl.trim()) {
    roomInfo.CoverURL = params.coverUrl.trim();
  }

  if (params.maxSeatCount && (params.seatTemplate === 'AudioSalon' || params.seatTemplate === 'Karaoke')) {
    roomInfo.MaxSeatCount = Number(params.maxSeatCount);
  }

  // Owner_Account 必须是已导入 IM 的账号，否则 create_room 常见 100002 invalid owner account
  const importRes = await importAccount(
    params.anchorId,
    params.title?.trim() || '',
    params.coverUrl?.trim() || ''
  );
  if (params.useObsStreaming) {
    console.log('[Live-OBS][createRoom] account_import (anchor)', {
      RoomId: params.roomId,
      UserID: params.anchorId,
      RequestId: (importRes as any)?.RequestId,
      ErrorCode: (importRes as any)?.ErrorCode ?? (importRes as any)?.Error,
      ErrorInfo: (importRes as any)?.ErrorInfo,
    });
  }
  if (importRes.ErrorCode !== 0 && importRes.Error !== 0) {
    if (importRes.ErrorCode !== 70102) {
      return {
        ErrorCode: importRes.ErrorCode,
        ErrorInfo: importRes.ErrorInfo || '导入主播 IM 账号失败，无法创建房间',
      } as CreateRoomResponse;
    }
  }

  const createResult = await trtcRequest(TRTCApi.createRoom, { RoomInfo: roomInfo }) as CreateRoomResponse;
  if (params.useObsStreaming) {
    console.log('[Live-OBS][createRoom] create_room', {
      RoomId: params.roomId,
      RequestId: (createResult as any)?.RequestId,
      ErrorCode: createResult.ErrorCode,
      ErrorInfo: createResult.ErrorInfo,
    });
  }

  // 房间创建成功后再设置自定义信息（需要等房间创建完成后才能设置元数据）
  if (params.customInfo && Object.keys(params.customInfo).length > 0) {
    if (createResult.ErrorCode === 0 || createResult.ErrorCode === undefined) {
      const metadata = Object.entries(params.customInfo).map(([Key, Value]) => ({ Key, Value }));
      await trtcRequest(TRTCApi.setRoomMetadata, { RoomId: params.roomId, Metadata: metadata });
    }
  }

  return createResult;
}

// 更新房间信息
export async function updateRoomInfo(
  roomId: string,
  params: { roomName?: string; coverUrl?: string; isMessageDisabled?: boolean; customInfo?: Record<string, string>; deleteKeys?: string[] }
): Promise<any> {
  const tasks: Promise<any>[] = [];

  const roomInfoParams: any = { RoomId: roomId, IsUnlimitedRoomEnabled: true };
  if (params.roomName !== undefined) roomInfoParams.RoomName = params.roomName;
  if (params.coverUrl !== undefined) roomInfoParams.CoverURL = params.coverUrl;
  if (params.isMessageDisabled !== undefined) roomInfoParams.IsMessageDisabled = params.isMessageDisabled;
  tasks.push(trtcRequest(TRTCApi.updateRoomInfo, { RoomInfo: roomInfoParams }));

  if (params.customInfo && Object.keys(params.customInfo).length > 0) {
    const metadata = Object.entries(params.customInfo).map(([Key, Value]) => ({ Key, Value }));
    tasks.push(trtcRequest(TRTCApi.setRoomMetadata, { RoomId: roomId, Metadata: metadata }));
  }

  if (params.deleteKeys && params.deleteKeys.length > 0) {
    tasks.push(trtcRequest(TRTCApi.delRoomMetadata, { RoomId: roomId, Keys: params.deleteKeys }));
  }

  const results = await Promise.all(tasks);
  return results[0];
}

// 删除直播间
export async function deleteRoom(roomId: string): Promise<any> {
  return trtcRequest(TRTCApi.destroyRoom, { RoomId: roomId });
}

/** 管理端自定义消息 BusinessId：观众端 TUIRiveKit / IM 需订阅并解析同名自定义消息 */
export const LIVE_MANAGER_CUSTOM_BUSINESS_ID = 'live_mgr_action';

export type LiveManagerCustomPayload =
  | {
      action: 'comment_visibility';
      /** true 表示允许评论；false 表示仅隐藏/关闭评论（与房间 IsMessageDisabled 语义一致由管理端写入） */
      enabled: boolean;
      roomId: string;
      ts: number;
    }
  | Record<string, unknown>;

/**
 * 向房间内广播管理端自定义信令（经 live_engine send_custom_msg）
 */
export async function broadcastLiveManagerSignal(roomId: string, payload: LiveManagerCustomPayload): Promise<any> {
  return sendCustomMessage(roomId, LIVE_MANAGER_CUSTOM_BUSINESS_ID, JSON.stringify(payload), 'admin');
}

/**
 * 开关「全员可发评论」：更新房间 IsMessageDisabled，并广播 comment_visibility 供观众端即时刷新 UI。
 * @param commentsEnabled true 允许评论；false 全员禁言（与 updateRoomInfo isMessageDisabled 相反）
 */
export async function setRoomCommentsEnabled(roomId: string, commentsEnabled: boolean): Promise<{
  updateResult: any;
  signalResult?: any;
}> {
  const updateResult = await updateRoomInfo(roomId, { isMessageDisabled: !commentsEnabled });
  let signalResult: any;
  try {
    signalResult = await broadcastLiveManagerSignal(roomId, {
      action: 'comment_visibility',
      enabled: commentsEnabled,
      roomId,
      ts: Date.now(),
    });
  } catch (e: any) {
    signalResult = { ErrorCode: -1, ErrorInfo: e?.message || 'broadcast failed' };
  }
  return { updateResult, signalResult };
}

/**
 * 将观众移出当前直播房间（REST kick_user_out，参见腾讯云「移出用户」能力说明 https://cloud.tencent.com/document/product/647/37078 ）
 */
export async function kickUsersOutRoom(
  roomId: string,
  memberAccounts: string[],
  reason = '管理员移出房间'
): Promise<{ ErrorCode: number; ErrorInfo?: string }> {
  return trtcRequest(TRTCApi.kickUserOut, {
    RoomId: roomId,
    MemberList_Account: memberAccounts,
    Reason: reason,
  });
}

// 禁言成员
export async function muteMember(roomId: string, memberAccounts: string[], muteTime: number = 600): Promise<any> {
  return trtcRequest(TRTCApi.muteMember, { RoomId: roomId, MemberList_Account: memberAccounts, MuteTime: muteTime });
}

// 解除禁言
export async function unmuteMember(roomId: string, memberAccounts: string[]): Promise<any> {
  return trtcRequest(TRTCApi.muteMember, { RoomId: roomId, MemberList_Account: memberAccounts, MuteTime: 0 });
}

// 封禁成员
export async function banMember(roomId: string, memberAccounts: string[], duration: number = 3600, reason: string = ''): Promise<any> {
  return trtcRequest(TRTCApi.banMember, { RoomId: roomId, MemberList_Account: memberAccounts, Duration: duration, Reason: reason });
}

// 解除封禁
export async function unbanMember(roomId: string, memberAccounts: string[]): Promise<any> {
  return trtcRequest(TRTCApi.unbanMember, { RoomId: roomId, MemberList_Account: memberAccounts });
}

// 获取封禁成员列表
export async function getBannedMemberList(roomId: string, next: number = 0): Promise<any> {
  return trtcRequest(TRTCApi.getBannedMemberList, { RoomId: roomId, Next: next });
}

// 获取禁言成员列表
export async function getMutedMemberList(roomId: string, offset: number = 0, limit: number = 50): Promise<any> {
  return trtcRequest(TRTCApi.getMutedMemberList, { RoomId: roomId, Offset: offset, Limit: limit });
}

// 获取 OBS 推流信息（异步：当 anchorId 与当前用户不同时，会向服务端请求配套的 userSig）
export async function getStreamInfo(roomId: string, anchorId?: string): Promise<{ PushInfo?: { ServerUrl: string; StreamKey: string }; ErrorCode: number; ErrorInfo?: string }> {
  const info = await getStreamInfoAsync(roomId, anchorId);
  if (!info) {
    return { ErrorCode: -1, ErrorInfo: '无法生成推流信息：缺少凭证或获取主播 UserSig 失败' };
  }
  return { ErrorCode: 0, PushInfo: info };
}

// OBS 开播
export async function startObsLive(roomId: string, anchorId: string, robotId: string): Promise<StartObsLiveResponse> {
  const steps: any = { pushInfo: null, addRobot: null, pickSeat: null };
  const errors: string[] = [];

  // 异步生成推流信息（确保 userId 和 userSig 配套）
  const streamInfo = await getStreamInfoAsync(roomId, anchorId);
  if (streamInfo) {
    steps.pushInfo = streamInfo;
  } else {
    errors.push('生成推流信息失败：缺少凭证或获取主播 UserSig 失败');
  }

  try {
    const robotResult = await trtcRequest(TRTCApi.addRobot, { RoomId: String(roomId), RobotList_Account: [String(robotId)] });
    steps.addRobot = robotResult;
    if (robotResult.ErrorCode && robotResult.ErrorCode !== 0) {
      errors.push(`添加机器人失败: ${robotResult.ErrorInfo || '未知错误'}`);
    }
  } catch (e: any) {
    errors.push(`添加机器人异常: ${e.message}`);
  }

  try {
    const seatResult = await trtcRequest(TRTCApi.pickUserOnSeat, { RoomId: String(roomId), Member_Account: String(robotId), Index: 0 });
    steps.pickSeat = seatResult;
    if (seatResult.ErrorCode && seatResult.ErrorCode !== 0) {
      errors.push(`机器人上麦失败: ${seatResult.ErrorInfo || '未知错误'}`);
    }
  } catch (e: any) {
    errors.push(`机器人上麦异常: ${e.message}`);
  }

  return {
    ErrorCode: errors.length > 0 ? -1 : 0,
    ErrorInfo: errors.length > 0 ? errors.join('; ') : 'success',
    PushInfo: steps.pushInfo,
    Steps: steps,
  };
}

// 获取房间机器人列表
export async function getRobotList(roomId: string): Promise<GetRobotResponse> {
  return trtcRequest<GetRobotResponse>(TRTCApi.getRobot, { RoomId: roomId });
}

// 获取麦位列表
export async function getSeatList(roomId: string): Promise<GetSeatListResponse> {
  return trtcRequest<GetSeatListResponse>(TRTCApi.getSeatList, { RoomId: roomId });
}

// 删除机器人
export async function delRobot(roomId: string, robotAccounts: string[]): Promise<{ ErrorCode: number; ErrorInfo?: string }> {
  return trtcRequest(TRTCApi.delRobot, { RoomId: roomId, RobotList_Account: robotAccounts });
}

// 用户下麦
export async function kickUserOffSeat(roomId: string, memberAccount: string): Promise<{ ErrorCode: number; ErrorInfo?: string }> {
  return trtcRequest(TRTCApi.kickUserOffSeat, { RoomId: roomId, Member_Account: memberAccount });
}

// 用户上麦
export async function pickUserOnSeat(roomId: string, memberAccount: string, index: number = 0): Promise<{ ErrorCode: number; ErrorInfo?: string }> {
  return trtcRequest(TRTCApi.pickUserOnSeat, { RoomId: roomId, Member_Account: memberAccount, Index: index });
}

// 添加机器人
export async function addRobot(roomId: string, robotAccounts: string[]): Promise<{ ErrorCode: number; ErrorInfo?: string }> {
  return trtcRequest(TRTCApi.addRobot, { RoomId: roomId, RobotList_Account: robotAccounts });
}

// 导入单个账号到 IM 账号系统（机器人需先导入才能添加）
export async function importAccount(userId: string, nick?: string, faceUrl?: string): Promise<{ ErrorCode: number; ErrorInfo?: string; Error: number }> {
  return trtcRequest(TRTCApi.importAccount, { UserID: userId, Nick: nick || '', FaceUrl: faceUrl || '' });
}

/** 凑数机器人 UserID 前缀，与房间已有机器人列表对齐递增，避免重复 */
export const CROWD_ROBOT_USER_ID_PREFIX = 'auto_robot';

export interface CrowdRobotBatchFailure {
  userId: string;
  phase: 'import' | 'add_robot';
  ErrorCode: number;
  ErrorInfo?: string;
}

export interface BatchAddCrowdRobotsResult {
  roomId: string;
  requested: number;
  plannedUserIds: string[];
  importReadyCount: number;
  addedCount: number;
  failures: CrowdRobotBatchFailure[];
}

/** 解析 get_robot 返回的机器人 UserID 列表（兼容 Response 内与根级 RobotList_Account） */
export function parseRobotListFromGetRobotResponse(res: GetRobotResponse): string[] {
  const fromNested = res.Response?.RobotList_Account;
  if (Array.isArray(fromNested)) return fromNested.map(String);
  const fromRoot = res.RobotList_Account;
  if (Array.isArray(fromRoot)) return fromRoot.map(String);
  return [];
}

function crowdRobotNextIndexStorageKey(roomId: string): string {
  return `live_mgr_crowd_robot_next_${roomId}`;
}

/** 本标签页内记录的「下一个 auto_robot 数字后缀」，防止 get_robot 短暂为空或与云端不一致时重复从 1 开始 */
function readLocalCrowdRobotNextIndex(roomId: string): number {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(crowdRobotNextIndexStorageKey(roomId)) : null;
    if (raw == null || raw === '') return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

function writeLocalCrowdRobotNextIndex(roomId: string, nextNumericSuffix: number): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(crowdRobotNextIndexStorageKey(roomId), String(Math.max(1, Math.floor(nextNumericSuffix))));
  } catch {
    /* 无痕模式等 */
  }
}

function nextCrowdRobotIndex(existingRobotUserIds: string[]): number {
  const re = /^auto_robot(\d+)$/;
  let max = 0;
  for (const id of existingRobotUserIds) {
    const m = String(id).match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/** 批量 add_robot 失败时按单个重试；已在房内等幂等情况计为成功 */
async function addRobotsChunkWithFallback(
  roomId: string,
  chunk: string[]
): Promise<{ added: number; failures: CrowdRobotBatchFailure[] }> {
  const batchRes = await addRobot(roomId, chunk);
  if (batchRes.ErrorCode === 0 || batchRes.ErrorCode === undefined) {
    return { added: chunk.length, failures: [] };
  }

  let added = 0;
  const failures: CrowdRobotBatchFailure[] = [];
  for (const userId of chunk) {
    const one = await addRobot(roomId, [userId]);
    if (one.ErrorCode === 0 || one.ErrorCode === undefined) {
      added += 1;
      continue;
    }
    const info = String(one.ErrorInfo || '');
    const lower = info.toLowerCase();
    const looksAlreadyInRoom =
      lower.includes('already') ||
      lower.includes('duplicate') ||
      lower.includes('exist') ||
      info.includes('已') ||
      info.includes('重复') ||
      info.includes('已在');
    if (looksAlreadyInRoom) {
      added += 1;
      continue;
    }
    failures.push({
      userId,
      phase: 'add_robot',
      ErrorCode: one.ErrorCode ?? -1,
      ErrorInfo: one.ErrorInfo,
    });
  }
  return { added, failures };
}

function importAccountOkForRobot(res: { ErrorCode: number; ErrorInfo?: string; Error: number }): boolean {
  if (res.ErrorCode === 70102) return true;
  return !(res.ErrorCode !== 0 && res.Error !== 0);
}

/**
 * 批量导入 IM 账号并调用 add_robot 加入房间（仅作在线人数凑数，不上麦）。
 * 需已具备管理端登录态（trtc_proxy）。
 */
export async function batchAddCrowdRobotsToRoom(
  roomId: string,
  count: number,
  options?: { importConcurrency?: number; addRobotChunkSize?: number }
): Promise<BatchAddCrowdRobotsResult> {
  const importConcurrency = Math.max(1, Math.min(20, options?.importConcurrency ?? 10));
  const addRobotChunkSize = Math.max(1, Math.min(50, options?.addRobotChunkSize ?? 20));

  const safeCount = Math.floor(Number(count));
  if (!roomId || safeCount < 1 || safeCount > 200) {
    throw new Error('数量需在 1～200 之间');
  }

  const robotRes = await getRobotList(roomId);
  if (robotRes.ErrorCode !== undefined && robotRes.ErrorCode !== 0) {
    throw new Error(robotRes.ErrorInfo || `拉取房间机器人列表失败 (${robotRes.ErrorCode})`);
  }

  const existing = parseRobotListFromGetRobotResponse(robotRes);
  const fromServer = nextCrowdRobotIndex(existing);
  const fromLocal = readLocalCrowdRobotNextIndex(roomId);
  const start = Math.max(fromServer, fromLocal);
  const plannedUserIds: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    plannedUserIds.push(`${CROWD_ROBOT_USER_ID_PREFIX}${start + i}`);
  }

  if (typeof console !== 'undefined' && console.info) {
    console.info('[batchAddCrowdRobotsToRoom]', {
      roomId,
      existingRobotCount: existing.length,
      fromServer,
      fromLocal,
      start,
      plannedRange: `${plannedUserIds[0]}…${plannedUserIds[plannedUserIds.length - 1]}`,
    });
  }

  const failures: CrowdRobotBatchFailure[] = [];
  const idsReadyForAdd: string[] = [];

  for (let offset = 0; offset < plannedUserIds.length; offset += importConcurrency) {
    const slice = plannedUserIds.slice(offset, offset + importConcurrency);
    const results = await Promise.all(
      slice.map(async (userId) => {
        const importRes = await importAccount(userId, `凑数 ${userId}`, '');
        return { userId, importRes };
      })
    );
    for (const { userId, importRes } of results) {
      if (importAccountOkForRobot(importRes)) {
        idsReadyForAdd.push(userId);
      } else {
        failures.push({
          userId,
          phase: 'import',
          ErrorCode: importRes.ErrorCode || importRes.Error || -1,
          ErrorInfo: importRes.ErrorInfo,
        });
      }
    }
  }

  let addedCount = 0;
  for (let offset = 0; offset < idsReadyForAdd.length; offset += addRobotChunkSize) {
    const chunk = idsReadyForAdd.slice(offset, offset + addRobotChunkSize);
    const { added, failures: chunkFails } = await addRobotsChunkWithFallback(roomId, chunk);
    addedCount += added;
    failures.push(...chunkFails);
  }

  writeLocalCrowdRobotNextIndex(roomId, start + safeCount);

  return {
    roomId,
    requested: safeCount,
    plannedUserIds,
    importReadyCount: idsReadyForAdd.length,
    addedCount,
    failures,
  };
}
