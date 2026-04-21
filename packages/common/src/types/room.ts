// 主播信息
export interface AnchorInfo {
  id: string;
  name: string;
  avatar: string;
}

// 直播间信息
export interface RoomInfo {
  id: string;
  title: string;
  coverUrl: string;
  anchor: AnchorInfo;
  onlineCount: number;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  isMessageDisabled?: boolean;

  // RoomEngine 协议字段
  roomType?: string;
  isSeatEnabled?: boolean;
  takeSeatMode?: 'FreeToTake' | 'ApplyToTake';
  maxSeatCount?: number;
  maxMemberCount?: number;
  category?: string[];
  activityStatus?: number;
  viewCount?: number;
  isPublicVisible?: boolean;
  notice?: string;

  // 统计字段
  likeCount?: number;
  isLikeEnabled?: boolean;
  giftCount?: number;
  giftAmount?: number;
  commentCount?: number;
  memberCount?: number;
  duration?: number;
  customInfo?: Record<string, string>;
}

// 推流信息
export interface StreamInfo {
  serverUrl: string;
  streamKey: string;
}

// SeatTemplate 布局模板
export type SeatTemplate =
  | 'VideoDynamicGrid9Seats'
  | 'VideoDynamicFloat7Seats'
  | 'VideoFixedGrid9Seats'
  | 'VideoFixedFloat7Seats'
  | 'VideoLandscape4Seat'
  | 'AudioSalon'
  | 'Karaoke';

// 创建直播间请求参数
export interface CreateRoomParams {
  anchorId: string;
  roomId?: string;
  title?: string;
  coverUrl?: string;
  seatTemplate?: SeatTemplate;
  maxSeatCount?: number;
  customData?: Record<string, unknown>;
}

// 直播间列表请求参数
export interface RoomListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

// 直播间列表响应
export interface RoomListResponse {
  list: RoomInfo[];
  total: number;
  page: number;
  pageSize: number;
}

// 房间统计数据
export interface RoomStats {
  onlineCount: number;
  commentCount: number;
  giftCount: number;
  giftAmount: number;
  duration?: number;
  commentUserCount?: number;
  giftUserCount?: number;
}

// 创建直播间响应
export interface CreateRoomResponse {
  ErrorCode: number;
  ErrorInfo?: string;
  ErrorMessage?: string;
  message?: string;
  Response?: {
    RoomInfo?: RoomInfo;
  };
}

// 视频清晰度信息
export interface VideoQuality {
  Level: number;
  Bitrate: number;
}

// 直播间列表项（TRTC 原始格式）
export interface RoomListItem {
  RoomName: string;
  RoomId: string;
  Owner_Account: string;
  CoverURL: string;
  Category: number[];
  CreateTime: number;
  RoomStatus: number;
  CustomInfo: string;
  ActivityStatus: number;
  ViewCount: number;
  Popularity: number;
  IsUnlimitedRoomEnabled: boolean;
  CDNUrl: string;
  SeatLayoutTemplateId: number;
  VideoQualityList: VideoQuality[];
  MultiQualityTranscodeMode: number;
}

// LEB 密钥信息
export interface LEBKeyInfo {
  SecretKey: string;
  Encrypted: string;
  Signature: string;
}

// 获取直播间列表响应（TRTC 原始格式）
export interface GetLiveListResponse {
  ErrorCode: number;
  ErrorInfo: string;
  ActionStatus: string;
  RequestId: string;
  Response?: {
    LEBKeyInfo?: LEBKeyInfo;
    Next: string;
    RoomList: RoomListItem[];
  };
}

// 麦位项
export interface SeatItem {
  Index: number;
  Member_Account?: string;
  IsTakenDisabled: boolean;
  IsVideoDisabled: boolean;
  IsAudioDisabled: boolean;
}

// 麦位列表响应
export interface GetSeatListResponse {
  ErrorCode: number;
  ErrorInfo?: string;
  Response?: {
    SeatList: SeatItem[];
  };
}

// 机器人列表响应
export interface GetRobotResponse {
  ErrorCode: number;
  ErrorInfo?: string;
  /** 部分网关/代理可能与 Response 并列返回机器人列表 */
  RobotList_Account?: string[];
  Response?: {
    RobotList_Account: string[];
  };
}

// OBS 开播响应
export interface StartObsLiveResponse {
  ErrorCode: number;
  ErrorInfo?: string;
  PushInfo?: {
    ServerUrl: string;
    StreamKey: string;
  };
  Steps?: {
    pushInfo: any;
    addRobot: any;
    pickSeat: any;
  };
}
