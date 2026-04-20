/**
 * 主播入口 Token API
 *
 * - `issueHostEntryToken`：管理端生成可复制的主播入口链接。
 * - `consumeHostEntryToken`：主播页打开后换取短期凭证（sdkAppId + userId + userSig）。
 */
import { post } from './client';

export interface HostEntryIssueResponse {
  code: number;
  message: string;
  data?: {
    token: string;
    roomId: string;
    userId: string;
    expiresIn: number;
  };
}

export interface HostEntryConsumeResponse {
  code: number;
  message: string;
  data?: {
    sdkAppId: number;
    userId: string;
    userSig: string;
    roomId: string;
  };
}

export async function issueHostEntryToken(params: {
  roomId: string;
  userId?: string;
  ttlSeconds?: number;
}): Promise<HostEntryIssueResponse> {
  return post<HostEntryIssueResponse>('/host_entry/issue', params);
}

export async function consumeHostEntryToken(token: string): Promise<HostEntryConsumeResponse> {
  return post<HostEntryConsumeResponse>('/host_entry/consume', { token });
}

/** 主播用入口 token 解散当前直播间（服务端以房主身份调 destroy_room，避免 SDK endLive 100006） */
export async function destroyHostRoomByEntryToken(params: {
  token: string;
  roomId: string;
}): Promise<{ code: number; message: string; data?: { ErrorCode?: number; ErrorInfo?: string } }> {
  return post('/host_entry/destroy_room', { token: params.token, roomId: params.roomId });
}

export function buildHostEntryUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/host?token=${encodeURIComponent(token)}`;
}
