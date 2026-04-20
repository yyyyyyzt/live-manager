/**
 * 房间 API - 从共享包重新导出
 */
import './client';

export {
  getRoomList,
  getRoomDetail,
  getRoomStats,
  getRoomStatistic,
  getGiftStats,
  closeRoom,
  banRoom,
  createRoom,
  updateRoomInfo,
  deleteRoom,
  muteMember,
  unmuteMember,
  banMember,
  unbanMember,
  getBannedMemberList,
  getMutedMemberList,
  getStreamInfoAsync,
  startObsLive,
  getRobotList,
  getSeatList,
  delRobot,
  kickUserOffSeat,
  pickUserOnSeat,
  addRobot,
  importAccount,
  kickUsersOutRoom,
  setRoomCommentsEnabled,
  LIVE_MANAGER_CUSTOM_BUSINESS_ID,
} from '@live-manager/common';
export type {
  VideoQuality,
  RoomListItem,
  LEBKeyInfo,
  GetLiveListResponse,
  StartObsLiveResponse,
  GetRobotResponse,
  SeatItem,
  GetSeatListResponse,
  CreateRoomResponse,
  RoomStatisticResponse,
  LiveManagerCustomPayload,
} from '@live-manager/common';
