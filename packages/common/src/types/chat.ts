// 用户角色
export type UserRole = 'user' | 'admin' | 'anchor';

// 聊天消息
export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: number;
  role: UserRole;
}

// 禁言状态
export interface MuteStatus {
  isMuteAll: boolean;
  mutedUsers: MutedUser[];
}

// 被禁言用户
export interface MutedUser {
  userId: string;
  userName: string;
  muteEndTime: number;
}

// 禁言请求参数
export interface MuteUserParams {
  roomId: string;
  userId: string;
  duration?: number;
}

// 全员禁言请求参数
export interface MuteAllParams {
  roomId: string;
  isMute: boolean;
}
