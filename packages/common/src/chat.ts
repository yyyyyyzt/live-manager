import { get } from './client';
import { trtcRequest, TRTCApi } from './trtc-client';
import type { ChatMessage, MuteStatus } from './types';

// 获取历史消息
export async function getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  return get<ChatMessage[]>(`/chat/${roomId}/messages`, { limit });
}

// 发送管理员消息
export async function sendMessage(roomId: string, content: string): Promise<any> {
  return trtcRequest(TRTCApi.sendTextMsg, {
    RoomId: roomId,
    Sender_Account: 'admin',
    TextContent: content,
  });
}

// 发送自定义消息
export async function sendCustomMessage(
  roomId: string,
  businessId: string,
  data: string,
  senderAccount = 'admin'
): Promise<any> {
  return trtcRequest(TRTCApi.sendCustomMsg, {
    RoomId: roomId,
    Sender_Account: senderAccount,
    BusinessId: businessId,
    Data: data,
  });
}

// 全员禁言
export async function setMuteAll(roomId: string, isMute: boolean): Promise<any> {
  return trtcRequest(TRTCApi.updateRoomInfo, {
    RoomInfo: {
      RoomId: roomId,
      IsMessageDisabled: isMute,
      IsUnlimitedRoomEnabled: true,
    },
  });
}

// 禁言指定用户
export async function muteUser(roomId: string, userId: string, duration?: number): Promise<any> {
  return trtcRequest(TRTCApi.muteMember, {
    RoomId: roomId,
    MemberList_Account: [userId],
    MuteTime: duration || 60,
  });
}

// 解除用户禁言
export async function unmuteUser(roomId: string, userId: string): Promise<any> {
  return trtcRequest(TRTCApi.muteMember, {
    RoomId: roomId,
    MemberList_Account: [userId],
    MuteTime: 0,
  });
}

// 获取禁言状态
export async function getMuteStatus(roomId: string): Promise<MuteStatus> {
  return get<MuteStatus>(`/chat/${roomId}/mute-status`);
}
