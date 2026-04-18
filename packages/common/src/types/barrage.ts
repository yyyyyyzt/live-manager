// 弹幕消息类型定义

export interface BarrageSenderInfo {
  userId: string;
  userName?: string;
  nameCard?: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

export interface Barrage {
  liveId: string;
  sender: BarrageSenderInfo;
  sequence: number;
  timestampInSecond: number;
  messageType: 0 | 1;
  textContent?: string;
  extensionInfo?: Record<string, string> | null;
  businessId?: string;
  data?: string;
}

export interface MessageListProps {
  onMuteUser?: (userId: string, userName: string, isMuted: boolean) => void;
  onBanUser?: (userId: string, userName: string, isBanned: boolean) => void;
  mutedList?: Array<{ userId: string; endTime: number }>;
  bannedList?: Array<{ userId: string; endTime: number }>;
}

export interface DropdownPosition {
  top: number;
  left: number;
}
