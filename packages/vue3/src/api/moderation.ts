/**
 * 评论先审后发（经管理端 server 代理至 audit-server）
 * @see docs/AUDIENCE_MODERATION_CONTRACT.md
 */
import './client';
import { get, post } from '@live-manager/common';

export interface ModerationCommentItem {
  id: string;
  roomId: string;
  senderId: string;
  author?: string;
  text: string;
  status: string;
  clientMsgId?: string;
  messageId?: string;
  createdAt: number;
  approvedAt?: number;
  rejectedAt?: number;
}

export async function getPendingComments(roomId: string): Promise<{
  code: number;
  message?: string;
  data?: { list: ModerationCommentItem[] };
}> {
  return get('/moderation/comments/pending', { roomId });
}

export async function approveComment(commentId: string, roomId: string): Promise<{
  code: number;
  message?: string;
  data?: { item?: ModerationCommentItem; push?: unknown };
}> {
  return post(`/moderation/comments/${encodeURIComponent(commentId)}/approve`, { roomId });
}

export async function rejectComment(commentId: string, roomId: string): Promise<{
  code: number;
  message?: string;
  data?: { ok?: boolean };
}> {
  return post(`/moderation/comments/${encodeURIComponent(commentId)}/reject`, { roomId });
}
