import { get, post } from './client';

export interface ModerationPendingItem {
  id: string;
  roomId: string;
  clientMsgId?: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface ModerationPublishedItem extends ModerationPendingItem {
  approvedAt: number;
}

export interface ModerationApiOk<T> {
  code: number;
  message?: string;
  data?: T;
}

/** 观众端 / 网关：上报一条待审评论 */
export async function submitCommentForModeration(params: {
  roomId: string;
  senderId: string;
  text: string;
  clientMsgId?: string;
}): Promise<ModerationApiOk<{ id: string; duplicate?: boolean }>> {
  return post('/moderation/comments', params) as Promise<ModerationApiOk<{ id: string; duplicate?: boolean }>>;
}

/** 管理端：待审列表 */
export async function getModerationPending(roomId: string): Promise<ModerationApiOk<{ list: ModerationPendingItem[]; serverTime: number }>> {
  return get('/moderation/comments/pending', { roomId }) as Promise<
    ModerationApiOk<{ list: ModerationPendingItem[]; serverTime: number }>
  >;
}

/** 观众端：已通过评论（轮询） */
export async function getModerationPublished(params: {
  roomId: string;
  since?: number;
  limit?: number;
}): Promise<ModerationApiOk<{ list: ModerationPublishedItem[]; serverTime: number }>> {
  return get('/moderation/comments/published', {
    roomId: params.roomId,
    since: params.since ?? 0,
    limit: params.limit ?? 100,
  }) as Promise<ModerationApiOk<{ list: ModerationPublishedItem[]; serverTime: number }>>;
}

/** 管理端：通过 */
export async function approveModerationComment(
  roomId: string,
  commentId: string
): Promise<ModerationApiOk<{ item: ModerationPublishedItem }>> {
  return post(`/moderation/comments/${encodeURIComponent(commentId)}/approve`, { roomId }) as Promise<
    ModerationApiOk<{ item: ModerationPublishedItem }>
  >;
}

/** 管理端：拒绝 */
export async function rejectModerationComment(
  roomId: string,
  commentId: string
): Promise<ModerationApiOk<{ ok: boolean }>> {
  return post(`/moderation/comments/${encodeURIComponent(commentId)}/reject`, { roomId }) as Promise<
    ModerationApiOk<{ ok: boolean }>
  >;
}
