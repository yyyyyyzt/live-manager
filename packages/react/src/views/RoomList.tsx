import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppNavigate } from '../hooks/useAppNavigate';
import {
  Button,
  Card,
  Input,
  Dialog,
} from 'tdesign-react';
import {
  AddIcon,
  FileCopyIcon,
  LoginIcon,
  EditIcon,
  DeleteIcon,
  RefreshIcon,
  InfoCircleIcon,
  SearchIcon,
} from 'tdesign-icons-react';

import { deleteRoom, getRoomList, getRoomDetail, getStreamInfoAsync, getRobotList, getSeatList, type RoomListItem } from '../api/room';
import { getErrorMessage, ROOM_SEARCH_MAX_BYTES, getByteLength } from '@live-manager/common';
import { getUploadConfig } from '../api/upload';
import { Message } from '../components/Toast';
import CreateRoomModal from '../components/CreateRoomModal';
import EditRoomModal from '../components/EditRoomModal';
import type { StreamInfo } from '../types';
import { copyText } from '../utils';
import { DIALOG_WIDTH, defaultCoverUrl } from '@live-manager/common';
import '@live-manager/common/style/room-list.css';

// Room 类型继承自 RoomListItem，保持字段一致
type Room = RoomListItem;

const PAGE_SIZE = 20;

export default function RoomList() {
  const navigate = useAppNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    content: string;
    onConfirm: () => void;
  } | null>(null);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  // 缓存每页对应的 next 游标，用于前进/后退
  const pageCursorsRef = useRef<Map<number, string>>(new Map([[1, '']]));
  const [refreshing, setRefreshing] = useState(false);

  // 搜索状态
  const [searchInput, setSearchInput] = useState('');

  // 输入变化时更新值（超限仅红框提示，不拦截输入）
  const handleSearchInputChange = (value: string) => {
    setSearchInput(String(value));
  };

  // 上传配置
  const [obsModal, setObsModal] = useState<{
    visible: boolean;
    room: Room | null;
    robotId: string;
    streamInfo: StreamInfo | null;
    robotStatus: 'checking' | 'creating' | 'seating' | 'ready' | 'error' | 'none';
    robotStatusText: string;
    actionLoading: string;
  }>({
    visible: false,
    room: null,
    robotId: '',
    streamInfo: null,
    robotStatus: 'checking',
    robotStatusText: '',
    actionLoading: '',
  });

  // 上传配置
  const [uploadEnabled, setUploadEnabled] = useState(false);
  useEffect(() => {
    getUploadConfig().then(config => setUploadEnabled(config.enabled)).catch(() => { });
  }, []);

  // 加载指定页的房间列表
  const loadRooms = useCallback(async (page: number) => {
    setLoading(true);
    try {
      // 获取该页对应的 next 游标
      const nextCursor = pageCursorsRef.current.get(page) || '';
      const response = await getRoomList({ next: nextCursor, count: PAGE_SIZE, sortDirection: 'descend' });

      // 检查接口返回是否成功
      if (response.ErrorCode !== 0) {
        console.error('获取房间列表失败:', response.ErrorInfo);
        Message.error(getErrorMessage(response.ErrorCode, response.ErrorInfo, '获取房间列表失败'));
        return;
      }

      // 从 Response 中获取数据
      const roomList = response.Response?.RoomList || [];
      const next = response.Response?.Next || '';

      setRooms(roomList);
      setCurrentPage(page);

      // 缓存下一页的游标
      if (next && roomList.length > 0) {
        pageCursorsRef.current.set(page + 1, next);
      }

      // 判断是否还有更多数据
      setHasMoreData(!!next && roomList.length === PAGE_SIZE);
    } catch (error) {
      console.error('加载房间列表失败:', error);
      Message.error('加载房间列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    // 从 sessionStorage 恢复分页状态（游标 + 页码）
    let pageToLoad = 1;
    try {
      const savedPage = sessionStorage.getItem('roomList_currentPage');
      const savedCursors = sessionStorage.getItem('roomList_pageCursors');

      // 清除已读取的状态（一次性恢复）
      sessionStorage.removeItem('roomList_currentPage');
      sessionStorage.removeItem('roomList_pageCursors');

      if (savedPage && savedCursors) {
        const page = Number(savedPage);
        if (page > 0) {
          const cursors: [number, string][] = JSON.parse(savedCursors);
          pageCursorsRef.current = new Map(cursors);
          pageToLoad = page;
        }
      }
    } catch { /* 解析失败时回退到第1页 */ }

    loadRooms(pageToLoad);
  }, [loadRooms]);

  // 刷新列表（刷新当前页）
  const refreshRooms = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRooms(currentPage);
    } finally {
      setRefreshing(false);
    }
  }, [currentPage, loadRooms]);

  // 分页导航
  const goToPage = useCallback((page: number) => {
    if (page < 1) return;
    if (page > currentPage && !hasMoreData) return;
    loadRooms(page);
  }, [currentPage, hasMoreData, loadRooms]);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(/\//g, '-');
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setIsEditModalVisible(true);
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await deleteRoom(roomId);
      Message.success('解散直播间成功');
      // 如果当前页是最后一页且只剩最后一个房间，跳转到上一页
      const isLastPage = !hasMoreData;
      if (isLastPage && rooms.length <= 1 && currentPage > 1) {
        loadRooms(currentPage - 1);
      } else {
        loadRooms(currentPage);
      }
    } catch (error) {
      console.error('解散直播间失败:', error);
      Message.error('解散直播间失败');
    }
  };

  const handleEnterRoom = (roomId: string) => {
    // 保存分页游标到 sessionStorage，以便返回时恢复
    try {
      sessionStorage.setItem('roomList_currentPage', String(currentPage));
      sessionStorage.setItem('roomList_pageCursors', JSON.stringify(Array.from(pageCursorsRef.current.entries())));
    } catch { /* sessionStorage 不可用时静默忽略 */ }
    navigate(`/room-control/${roomId}`);
  };

  const handleCopyRoomId = (roomId: string) => {
    copyText(roomId);
    Message.success('直播间ID已复制');
  };

  // 搜索房间
  const handleSearch = async (keyword?: string) => {
    const input = (keyword ?? searchInput).trim();
    if (!input) {
      return;
    }
    if (getByteLength(input) > ROOM_SEARCH_MAX_BYTES) {
      Message.error('输入内容太长');
      return;
    }

    const roomId = input;

    setLoading(true);
    try {
      const response = await getRoomDetail(roomId);

      if (response.ErrorCode !== 0) {
        Message.error(getErrorMessage(response.ErrorCode, response.ErrorInfo, '未找到该直播间'));
        return;
      }

      const roomInfo = response.Response?.RoomInfo;
      if (roomInfo) {
        // 显示搜索结果（替换当前列表）
        setRooms([roomInfo]);
        setCurrentPage(1);
        setHasMoreData(false);
        Message.success('搜索成功');
      } else {
        Message.error('未找到该直播间');
      }
    } catch (error: any) {
      console.error('搜索直播间失败:', error);
      Message.error(`搜索失败: ${error.message || '网络错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 清空搜索并刷新列表
  const handleClearSearch = () => {
    setSearchInput('');
    // 重置分页状态
    pageCursorsRef.current = new Map([[1, '']]);
    setCurrentPage(1);
    setHasMoreData(true);
    // 刷新列表
    loadRooms(1);
  };

  // 显示详情对话框
  const handleShowDetail = async (room: Room) => {
    // OBS 机器人 ID 是主播 ID + "_obs"
    const anchorId = room.Owner_Account || '';
    const robotId = `${anchorId}_obs`;
    setObsModal({
      visible: true,
      room,
      robotId,
      streamInfo: null,
      robotStatus: 'checking',
      robotStatusText: '正在检查机器人状态...',
      actionLoading: '',
    });

    try {
      // 并行查询机器人列表和麦位列表
      const [robotList, seatMembers] = await Promise.all([
        getRobotList(room.RoomId).then(res => res.Response?.RobotList_Account || []).catch(() => [] as string[]),
        getSeatList(room.RoomId).then(res => {
          const members = new Set<string>();
          res.Response?.SeatList?.forEach(seat => {
            if (seat.Member_Account) members.add(seat.Member_Account);
          });
          return members;
        }).catch(() => new Set<string>()),
      ]);

      const hasRobot = robotList.includes(robotId);
      const onSeat = seatMembers.has(robotId);

      if (hasRobot && onSeat) {
        // 已有机器人且已上麦
        setObsModal(prev => ({ ...prev, robotStatus: 'ready', robotStatusText: `机器人 ${robotId} 已就绪（已上麦）` }));
        // 自动生成推流链接
        await autoGenerateStream(room, robotId);
        return;
      }

      if (!hasRobot) {
        // 没有机器人
        setObsModal(prev => ({ ...prev, robotStatus: 'none', robotStatusText: '未配置机器人' }));
      } else if (!onSeat) {
        // 有机器人但未上麦
        setObsModal(prev => ({ ...prev, robotStatus: 'none', robotStatusText: '机器人未上麦' }));
      }
    } catch (error: any) {
      setObsModal(prev => ({ ...prev, robotStatus: 'error', robotStatusText: `检查失败: ${error.message || '网络错误'}` }));
    }
  };

  // 自动生成推流链接（使用机器人 ID）
  const autoGenerateStream = async (room: Room, robotId: string) => {
    setObsModal(prev => ({ ...prev, actionLoading: 'stream' }));
    try {
      const pushInfo = await getStreamInfoAsync(room.RoomId, robotId);
      if (pushInfo) {
        setObsModal(prev => ({
          ...prev,
          streamInfo: { serverUrl: pushInfo.ServerUrl, streamKey: pushInfo.StreamKey },
          actionLoading: '',
        }));
      } else {
        setObsModal(prev => ({ ...prev, actionLoading: '' }));
        Message.error('获取推流信息失败');
      }
    } catch (error: any) {
      setObsModal(prev => ({ ...prev, actionLoading: '' }));
      Message.error(`获取推流信息失败: ${error.message || '网络错误'}`);
    }
  };

  const handleObsCopy = async (text: string, label: string) => {
    await copyText(text);
    Message.success(`${label}已复制到剪贴板`);
  };

  const handleObsClose = () => {
    setObsModal(prev => ({ ...prev, visible: false, room: null }));
  };

  return (
    <div className="room-list-page">
      {/* 页面头部 */}
      <div className="room-list-header">
        <h1 className="room-list-title">直播间管理</h1>
        <div className="header-actions">
          {/* 搜索框 */}
          <Input
            value={searchInput}
            onChange={handleSearchInputChange}
            onEnter={() => {
              if (getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES) {
                Message.error('输入内容太长');
                return;
              }
              handleSearch();
            }}
            clearable
            onClear={handleClearSearch}
            placeholder="输入房间 ID 搜索"
            suffixIcon={<SearchIcon size={16} />}
            style={{ width: 220 }}
            status={getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES ? 'error' : 'default'}
            tips={getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES ? '输入内容超出长度限制' : ''}
          />
          <Button
            shape="round"
            variant="outline"
            disabled={refreshing || loading}
            onClick={refreshRooms}
            icon={<RefreshIcon className={refreshing ? 'spinning' : ''} />}
          >
            刷新
          </Button>
          <Button
            shape="round"
            theme="primary"
            icon={<AddIcon />}
            onClick={() => setIsCreateModalVisible(true)}
          >
            新建直播间
          </Button>
        </div>
      </div>

      {/* 房间列表卡片 */}
      <Card className="room-list-card">
        {/* 表头 - 固定 */}
        <div className="room-list-header-fixed">
          <table className="room-table">
            <thead>
              <tr>
                <th className="col-id">直播间 ID</th>
                <th className="col-title">直播间标题</th>
                <th className="col-cover">直播间封面</th>
                <th className="col-anchor">主播 ID</th>
                <th className="room-col-time">创建时间</th>
                <th className="room-col-action">操作</th>
              </tr>
            </thead>
          </table>
        </div>
        {/* 表体 - 滚动 */}
        <div className="room-list-content">
          {!loading && rooms.length > 0 ? (
            <table className="room-table">
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.RoomId} className="room-row">
                    <td className="col-id">
                      <div className="room-id-cell">
                        <span className="room-id-text">{room.RoomId}</span>
                        <FileCopyIcon size={14} className="copy-icon" onClick={() => handleCopyRoomId(room.RoomId)} />
                      </div>
                    </td>
                    <td className="col-title">
                      <span className="room-name-text">{room.RoomName || '-'}</span>
                    </td>
                    <td className="col-cover">
                      <div className="room-cover-cell">
                        <img src={room.CoverURL || defaultCoverUrl} alt={room.RoomName} className="room-cover-image" />
                      </div>
                    </td>
                    <td className="col-anchor">
                      <span className="anchor-name">{room.Owner_Account || '-'}</span>
                    </td>
                    <td className="room-col-time">
                      <span className="create-time">{formatTime(room.CreateTime)}</span>
                    </td>
                    <td className="room-col-action">
                      <div className="action-cell">
                        <span className="action-link" title="进入房间" onClick={() => handleEnterRoom(room.RoomId)}>
                          <LoginIcon className="action-icon-only" />
                          <span className="action-text">进入房间</span>
                        </span>
                        <span className="action-link" title="房间详情" onClick={() => handleShowDetail(room)}>
                          <InfoCircleIcon className="action-icon-only" />
                          <span className="action-text">房间详情</span>
                        </span>
                        <span className="action-link" title="编辑" onClick={() => handleEditRoom(room)}>
                          <EditIcon className="action-icon-only" />
                          <span className="action-text">编辑</span>
                        </span>
                        <span className="action-link action-link-danger" title="解散" onClick={() => {
                          setConfirmDialog({
                            visible: true,
                            title: '解散直播间确认',
                            content: `解散后直播间将被永久删除，确认解散房间「${room.RoomName}」吗？`,
                            onConfirm: async () => {
                              await handleDeleteRoom(room.RoomId);
                              setConfirmDialog(prev => prev ? { ...prev, visible: false } : null);
                              setTimeout(() => setConfirmDialog(null), 300);
                            },
                          });
                        }}>
                          <DeleteIcon className="action-icon-only" />
                          <span className="action-text">解散</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : loading ? (
            <div className="room-loading-container">
              <div className="room-loading-spinner" />
              <span className="room-loading-text">加载中...</span>
            </div>
          ) : (
            <div className="room-empty-container">
              <span className="room-empty-text">暂无直播间数据</span>
            </div>
          )}
        </div>
      </Card>

      {/* 分页控制 */}
      <div className="room-list-pagination">
        <Button
          variant="outline"
          size="small"
          disabled={currentPage <= 1}
          onClick={() => goToPage(1)}
        >
          首页
        </Button>
        <Button
          variant="outline"
          size="small"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          上一页
        </Button>
        <span className="page-info">第 {currentPage} 页</span>
        <Button
          variant="outline"
          size="small"
          disabled={!hasMoreData}
          onClick={() => goToPage(currentPage + 1)}
        >
          下一页
        </Button>
      </div>

      {/* 创建直播间弹窗 */}
      <CreateRoomModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={() => {
          setIsCreateModalVisible(false);
          refreshRooms();
        }}
        uploadEnabled={uploadEnabled}
      />

      {/* 编辑直播间弹窗 */}
      {editingRoom && (
        <EditRoomModal
          visible={isEditModalVisible}
          room={{
            id: editingRoom.RoomId,
            title: editingRoom.RoomName,
            coverUrl: editingRoom.CoverURL,
            customInfo: editingRoom.CustomInfo ? (typeof editingRoom.CustomInfo === 'string' ? (() => { try { return JSON.parse(editingRoom.CustomInfo); } catch { return undefined; } })() : editingRoom.CustomInfo) : undefined,
          } as any}
          onClose={() => setIsEditModalVisible(false)}
          onSuccess={(updatedFields) => {
            setIsEditModalVisible(false);
            // 局部更新列表中被编辑的房间数据，避免整个页面刷新
            if (editingRoom) {
              setRooms(prev => prev.map(r => {
                if (r.RoomId === editingRoom.RoomId) {
                  return {
                    ...r,
                    RoomName: updatedFields.roomName,
                    CoverURL: updatedFields.coverUrl,
                  };
                }
                return r;
              }));
            }
          }}
          uploadEnabled={uploadEnabled}
        />
      )}

      {/* 确认弹窗 - 关闭时先隐藏再延迟清除，确保动画正常播放 */}
      <Dialog
        visible={confirmDialog?.visible || false}
        header={confirmDialog?.title || ''}
        onClose={() => {
          setConfirmDialog(prev => prev ? { ...prev, visible: false } : null);
          setTimeout(() => setConfirmDialog(null), 300);
        }}
        width={DIALOG_WIDTH.CONFIRM}
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => {
              setConfirmDialog(prev => prev ? { ...prev, visible: false } : null);
              setTimeout(() => setConfirmDialog(null), 300);
            }}>
              取消
            </Button>
            <Button shape="round" theme="primary" onClick={confirmDialog?.onConfirm}>
              确认解散
            </Button>
          </>
        }
      >
        <p>{confirmDialog?.content}</p>
      </Dialog>

      {/* 房间信息详情对话框 */}
      <Dialog
        visible={obsModal.visible && !!obsModal.room}
        header="房间信息"
        onClose={handleObsClose}
        width={DIALOG_WIDTH.INFO}
        className="room-info-modal"
        footer={
          <Button shape="round" variant="outline" onClick={handleObsClose}>关闭</Button>
        }
      >
        <div className="room-info-form">
          {/* 基本信息 */}
          <div className="room-info-section">
            <div className="room-info-section-title">基本信息</div>
            <div className="room-info-card">
              <div className="room-info-row">
                <span className="room-info-label">主播 ID</span>
                <div className="room-info-value-area">
                  <span className="room-info-value">{obsModal.room?.Owner_Account || '-'}</span>
                  {obsModal.room?.Owner_Account && (
                    <button className="room-info-copy-btn" onClick={() => obsModal.room && handleObsCopy(obsModal.room.Owner_Account, '直播间主播')}>
                      <FileCopyIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="room-info-row">
                <span className="room-info-label">直播间 ID</span>
                <div className="room-info-value-area">
                  <span className="room-info-value">{obsModal.room?.RoomId || '-'}</span>
                </div>
              </div>
              <div className="room-info-row">
                <span className="room-info-label">直播间标题</span>
                <div className="room-info-value-area">
                  <span className="room-info-value">{obsModal.room?.RoomName || '-'}</span>
                </div>
              </div>
              <div className="room-info-row">
                <span className="room-info-label">直播间封面</span>
                <div className="room-info-value-area">
                  <span className="room-info-value room-info-value-url">{obsModal.room?.CoverURL || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 推流信息 - 仅在有信息或加载中时显示 */}
          {(obsModal.streamInfo || obsModal.actionLoading === 'stream') && (
            <div className="room-info-section">
              <div className="room-info-section-title">推流信息</div>
              <div className="room-info-card">
                {obsModal.streamInfo ? (
                  <>
                    <div className="room-info-row">
                      <span className="room-info-label">服务器地址</span>
                      <div className="room-info-value-area">
                        <span className="room-info-value room-info-value-url">{obsModal.streamInfo.serverUrl}</span>
                        <button className="room-info-copy-btn" onClick={() => obsModal.streamInfo && handleObsCopy(obsModal.streamInfo.serverUrl, '服务器地址')}>
                          <FileCopyIcon size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="room-info-row">
                      <span className="room-info-label">推流码</span>
                      <div className="room-info-value-area">
                        <span className="room-info-value room-info-value-url">{obsModal.streamInfo.streamKey}</span>
                        <button className="room-info-copy-btn" onClick={() => obsModal.streamInfo && handleObsCopy(obsModal.streamInfo.streamKey, '推流码')}>
                          <FileCopyIcon size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="room-info-row">
                    <span className="room-info-label" style={{ width: 'auto' }}>正在获取推流信息...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}