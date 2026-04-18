<template>
  <div class="room-list-page">
    <!-- 页面头部 -->
    <div class="room-list-header">
      <h1 class="room-list-title">直播间管理</h1>
      <div class="header-actions">
        <!-- 搜索框 -->
        <n-input
          v-model:value="searchInput"
          placeholder="输入房间 ID 搜索"
          class="gift-search-input"
          style="width: 220px"
          clearable
          :status="getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES ? 'error' : undefined"
          @keyup.enter="handleSearch"
          @clear="handleClearSearch"
        >
          <template #suffix>
            <Search :size="16" style="cursor: pointer" @click="handleSearch" />
          </template>
        </n-input>
        <n-button ghost round :disabled="refreshing || loading" @click="refreshRooms">
          <template #icon>
            <RefreshCw :size="16" :class="{ spinning: refreshing }" />
          </template>
          刷新
        </n-button>
        <n-button type="primary" round @click="isCreateModalVisible = true">
          <template #icon>
            <Plus :size="16" />
          </template>
          新建直播间
        </n-button>
      </div>
    </div>

    <!-- 房间列表表格区域 -->
    <n-card class="room-list-card">
      <!-- 表头 - 固定 -->
      <div class="room-list-header-fixed">
        <table class="room-table">
          <thead>
            <tr>
              <th class="col-id">直播间 ID</th>
              <th class="col-title">直播间标题</th>
              <th class="col-cover">直播间封面</th>
              <th class="col-anchor">主播 ID</th>
              <th class="room-col-time">创建时间</th>
              <th class="room-col-action">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <!-- 表体 - 滚动 -->
      <div class="room-list-content">
        <table v-if="!loading && rooms.length > 0" class="room-table">
          <tbody>
            <tr v-for="room in rooms" :key="room.RoomId" class="room-row">
              <td class="col-id">
                <div class="room-id-cell">
                  <span class="room-id-text">{{ room.RoomId }}</span>
                  <Copy class="copy-icon" :size="16" @click="handleCopyRoomId(room.RoomId)" />
                </div>
              </td>
              <td class="col-title">
                <span class="room-name-text">{{ room.RoomName || '-' }}</span>
              </td>
              <td class="col-cover">
                <div class="room-cover-cell">
                  <img :src="room.CoverURL || defaultCoverUrl" :alt="room.RoomName" class="room-cover-image" />
                </div>
              </td>
              <td class="col-anchor">
                <span class="anchor-name">{{ room.Owner_Account || '-' }}</span>
              </td>
              <td class="room-col-time">
                <span class="create-time">{{ formatTime(room.CreateTime) }}</span>
              </td>
              <td class="room-col-action">
                <div class="action-cell">
                  <span class="action-link" title="进入房间" @click="handleEnterRoom(room.RoomId)">
                    <LogIn class="action-icon-only" :size="16" />
                    <span class="action-text">进入房间</span>
                  </span>
                  <span class="action-link" title="复制主播链接" @click="handleCopyHostLink(room)">
                    <LinkIcon class="action-icon-only" :size="16" />
                    <span class="action-text">主播链接</span>
                  </span>
                  <span class="action-link" title="房间详情" @click="handleShowDetail(room)">
                    <Info class="action-icon-only" :size="16" />
                    <span class="action-text">房间详情</span>
                  </span>
                  <span class="action-link" title="编辑" @click="handleEditRoom(room)">
                    <Pencil class="action-icon-only" :size="16" />
                    <span class="action-text">编辑</span>
                  </span>
                  <span class="action-link action-link-danger" title="解散" @click="handleDeleteConfirm(room)">
                    <Trash2 class="action-icon-only" :size="16" />
                    <span class="action-text">解散</span>
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="loading" class="room-loading-container">
          <div class="room-loading-spinner" />
          <span class="room-loading-text">加载中...</span>
        </div>
        <div v-else class="room-empty-container">
          <span class="room-empty-text">暂无直播间数据</span>
        </div>
      </div>
    </n-card>

    <!-- 分页控制 -->
    <div class="room-list-pagination">
      <n-button ghost
        size="small"
        :disabled="currentPage <= 1"
        @click="goToPage(1)"
      >
        首页
      </n-button>
      <n-button ghost
        size="small"
        :disabled="currentPage <= 1"
        @click="goToPage(currentPage - 1)"
      >
        上一页
      </n-button>
      <span class="page-info">第 {{ currentPage }} 页</span>
      <n-button ghost
        size="small"
        :disabled="!hasMoreData"
        @click="goToPage(currentPage + 1)"
      >
        下一页
      </n-button>
    </div>

    <!-- 创建直播间弹窗 -->
    <CreateRoomModal
      v-model:visible="isCreateModalVisible"
      :upload-enabled="uploadEnabled"
      @success="handleCreateSuccess"
    />

    <!-- 编辑直播间弹窗 -->
    <EditRoomModal
      v-model:visible="isEditModalVisible"
      :room="editingRoom"
      :upload-enabled="uploadEnabled"
      @success="handleEditSuccess"
    />

    <!-- 确认弹窗 -->
    <n-modal
      v-model:show="confirmDialogVisible"
      preset="card"
      :title="confirmDialogTitle"
      :style="{ width: '440px' }"
    >
      <p>{{ confirmDialogContent }}</p>
      <n-space justify="end" style="margin-top: 16px">
        <n-button @click="confirmDialogVisible = false">取消</n-button>
        <n-button type="error" @click="handleConfirmDelete">确认解散</n-button>
      </n-space>
    </n-modal>

    <!-- 房间信息详情对话框 -->
    <n-modal
      v-model:show="obsModalVisible"
      preset="card"
      title="房间信息"
      :style="{ width: '560px' }"
      class="room-info-modal"
    >
      <div class="room-info-form">
        <!-- 基本信息 -->
        <div class="room-info-section">
          <div class="room-info-section-title">基本信息</div>
          <div class="room-info-card">
            <div class="room-info-row">
              <span class="room-info-label">主播 ID</span>
              <div class="room-info-value-area">
                <span class="room-info-value">{{ obsModal.room?.Owner_Account || '-' }}</span>
                <button
                  v-if="obsModal.room?.Owner_Account"
                  class="room-info-copy-btn"
                  @click="handleObsCopy(obsModal.room.Owner_Account, '直播间主播')"
                >
                  <Copy :size="14" />
                </button>
              </div>
            </div>
            <div class="room-info-row">
              <span class="room-info-label">直播间 ID</span>
              <div class="room-info-value-area">
                <span class="room-info-value">{{ obsModal.room?.RoomId || '-' }}</span>
              </div>
            </div>
            <div class="room-info-row">
              <span class="room-info-label">直播间标题</span>
              <div class="room-info-value-area">
                <span class="room-info-value">{{ obsModal.room?.RoomName || '-' }}</span>
              </div>
            </div>
            <div class="room-info-row">
              <span class="room-info-label">直播间封面</span>
              <div class="room-info-value-area">
                <span class="room-info-value room-info-value-url">{{ obsModal.room?.CoverURL || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 推流信息 -->
        <div v-if="obsModal.streamInfo || obsModal.actionLoading === 'stream'" class="room-info-section">
          <div class="room-info-section-title">推流信息</div>
          <div class="room-info-card">
            <template v-if="obsModal.streamInfo">
              <div class="room-info-row">
                <span class="room-info-label">服务器地址</span>
                <div class="room-info-value-area">
                  <span class="room-info-value room-info-value-url">{{ obsModal.streamInfo.serverUrl }}</span>
                  <button
                    class="room-info-copy-btn"
                    @click="handleObsCopy(obsModal.streamInfo.serverUrl, '服务器地址')"
                  >
                    <Copy :size="14" />
                  </button>
                </div>
              </div>
              <div class="room-info-row">
                <span class="room-info-label">推流码</span>
                <div class="room-info-value-area">
                  <span class="room-info-value room-info-value-url">{{ obsModal.streamInfo.streamKey }}</span>
                  <button
                    class="room-info-copy-btn"
                    @click="handleObsCopy(obsModal.streamInfo.streamKey, '推流码')"
                  >
                    <Copy :size="14" />
                  </button>
                </div>
              </div>
            </template>
            <div v-else class="room-info-row">
              <span class="room-info-label" style="width: auto">正在获取推流信息...</span>
            </div>
          </div>
        </div>
      </div>

      <n-space justify="end" style="margin-top: 16px">
        <n-button ghost round @click="obsModalVisible = false">关闭</n-button>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Plus, Copy, LogIn, Pencil, Trash2, RefreshCw, Info, Search, Link2 as LinkIcon } from 'lucide-vue-next';
import { message } from '@/utils/message';
import '@live-manager/common/style/room-list.css';
import { getByteLength, ROOM_SEARCH_MAX_BYTES } from '@live-manager/common';
import {
  deleteRoom,
  getRoomList,
  getRoomDetail,
  getStreamInfoAsync,
  getRobotList,
  getSeatList,
} from '@/api/room';
import type { RoomListItem, StreamInfo } from '@/types';
import { getUploadConfig } from '@/api/upload';
import { copyText } from '@/utils';
import { defaultCoverUrl } from '@live-manager/common';
import CreateRoomModal from '@/components/CreateRoomModal.vue';
import EditRoomModal from '@/components/EditRoomModal.vue';
import { issueHostEntryToken, buildHostEntryUrl } from '@/api/host-entry';

type Room = RoomListItem;

const PAGE_SIZE = 20;

const router = useRouter();
const route = useRoute();

const rooms = ref<Room[]>([]);
const loading = ref(false);
const isCreateModalVisible = ref(false);
const isEditModalVisible = ref(false);
const editingRoom = ref<Room | null>(null);

// 确认弹窗
const confirmDialogVisible = ref(false);
const confirmDialogTitle = ref('');
const confirmDialogContent = ref('');
const pendingDeleteRoomId = ref('');

// 分页状态
const currentPage = ref(1);
const hasMoreData = ref(true);
const pageCursors = ref<Map<number, string>>(new Map([[1, '']]));
const refreshing = ref(false);

// 搜索状态
const searchInput = ref('');

// 上传配置
const uploadEnabled = ref(false);

// OBS 详情弹窗
const obsModalVisible = ref(false);
const obsModal = reactive<{
  room: Room | null;
  streamInfo: StreamInfo | null;
  actionLoading: string;
}>({
  room: null,
  streamInfo: null,
  actionLoading: '',
});

// 格式化时间
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

// 加载房间列表
const loadRooms = async (page: number) => {
  loading.value = true;
  try {
    const nextCursor = pageCursors.value.get(page) || '';
    const response = await getRoomList({ next: nextCursor, count: PAGE_SIZE, sortDirection: 'descend' });

    if (response.ErrorCode !== 0) {
      console.error('获取房间列表失败:', response.ErrorInfo);
      message.error(response.ErrorInfo || '获取房间列表失败');
      return;
    }

    const roomList = response.Response?.RoomList || [];
    const next = response.Response?.Next || '';

    rooms.value = roomList;
    currentPage.value = page;

    if (next && roomList.length > 0) {
      pageCursors.value.set(page + 1, next);
    }

    hasMoreData.value = !!next && roomList.length === PAGE_SIZE;
  } catch (error) {
    console.error('加载房间列表失败:', error);
    message.error('加载房间列表失败');
  } finally {
    loading.value = false;
  }
};

// 刷新列表
const refreshRooms = async () => {
  refreshing.value = true;
  try {
    await loadRooms(currentPage.value);
  } finally {
    refreshing.value = false;
  }
};

// 分页导航
const goToPage = (page: number) => {
  if (page < 1) return;
  if (page > currentPage.value && !hasMoreData.value) return;
  loadRooms(page);
};

// 进入房间
const handleEnterRoom = (roomId: string) => {
  // 保存分页游标到 sessionStorage，以便返回时恢复
  try {
    sessionStorage.setItem('roomList_currentPage', String(currentPage.value));
    sessionStorage.setItem('roomList_pageCursors', JSON.stringify(Array.from(pageCursors.value.entries())));
  } catch { /* sessionStorage 不可用时静默忽略 */ }
  router.push({
    path: `/room-control/${roomId}`,
  });
};

// 复制房间 ID
const handleCopyRoomId = (roomId: string) => {
  copyText(roomId);
  message.success('直播间ID已复制');
};

// 复制主播入口链接（含短期 token）
const handleCopyHostLink = async (room: Room) => {
  try {
    const res = await issueHostEntryToken({
      roomId: room.RoomId,
      userId: room.Owner_Account || undefined,
    });
    if (res.code !== 0 || !res.data?.token) {
      message.error(res.message || '生成主播链接失败');
      return;
    }
    const url = buildHostEntryUrl(res.data.token);
    await copyText(url);
    const ttlMin = Math.max(1, Math.round((res.data.expiresIn || 0) / 60));
    message.success(`主播链接已复制（${ttlMin} 分钟内有效）`);
  } catch (error: any) {
    console.error('生成主播链接失败:', error);
    message.error(error?.message || '生成主播链接失败');
  }
};

// 编辑房间
const handleEditRoom = (room: Room) => {
  editingRoom.value = room;
  isEditModalVisible.value = true;
};

// 删除确认
const handleDeleteConfirm = (room: Room) => {
  confirmDialogTitle.value = '解散直播间确认';
  confirmDialogContent.value = `解散后直播间将被永久删除，确认解散房间「${room.RoomName}」吗？`;
  pendingDeleteRoomId.value = room.RoomId;
  confirmDialogVisible.value = true;
};

// 确认删除
const handleConfirmDelete = async () => {
  if (!pendingDeleteRoomId.value) return;

  try {
    await deleteRoom(pendingDeleteRoomId.value);
    message.success('解散直播间成功');
    // 如果当前页是最后一页且只剩最后一个房间，跳转到上一页
    const isLastPage = !hasMoreData.value;
    if (isLastPage && rooms.value.length <= 1 && currentPage.value > 1) {
      loadRooms(currentPage.value - 1);
    } else {
      loadRooms(currentPage.value);
    }
  } catch (error) {
    console.error('解散直播间失败:', error);
    message.error('解散直播间失败');
  } finally {
    pendingDeleteRoomId.value = '';
    confirmDialogVisible.value = false;
  }
};

// 搜索房间
const handleSearch = async () => {
  const input = searchInput.value.trim();
  if (!input) {
    return;
  }
  if (getByteLength(input) > ROOM_SEARCH_MAX_BYTES) {
    message.error('输入内容太长');
    return;
  }

  const roomId = input;

  loading.value = true;
  try {
    const response = await getRoomDetail(roomId);

    if (response.ErrorCode !== 0) {
      message.error(response.ErrorInfo || '未找到该直播间');
      return;
    }

    const roomInfo = response.Response?.RoomInfo;
    if (roomInfo) {
      rooms.value = [roomInfo];
      currentPage.value = 1;
      hasMoreData.value = false;
      message.success('搜索成功');
    } else {
      message.error('未找到该直播间');
    }
  } catch (error: any) {
    console.error('搜索直播间失败:', error);
    message.error(`搜索失败: ${error.ErrorInfo || error.message || '网络错误'}`);
  } finally {
    loading.value = false;
  }
};

// 清空搜索并刷新列表
const handleClearSearch = () => {
  searchInput.value = '';
  // 重置分页状态
  pageCursors.value = new Map([[1, '']]);
  currentPage.value = 1;
  hasMoreData.value = true;
  // 刷新列表
  loadRooms(1);
};

// 显示详情
const handleShowDetail = async (room: Room) => {
  obsModal.room = room;
  obsModal.streamInfo = null;
  obsModal.actionLoading = '';
  obsModalVisible.value = true;

  try {
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

    const anchorId = room.Owner_Account || '';
    const robotId = `${anchorId}_obs`;
    const hasRobot = robotList.includes(robotId);
    const onSeat = seatMembers.has(robotId);

    if (hasRobot && onSeat) {
      await autoGenerateStream(room, robotId);
    }
  } catch (error: any) {
    console.error('获取房间详情失败:', error);
  }
};

// 自动生成推流链接（使用机器人 ID）
const autoGenerateStream = async (room: Room, robotId: string) => {
  obsModal.actionLoading = 'stream';
  try {
    const pushInfo = await getStreamInfoAsync(room.RoomId, robotId);
    if (pushInfo) {
      obsModal.streamInfo = { serverUrl: pushInfo.ServerUrl, streamKey: pushInfo.StreamKey };
    } else {
      message.error('获取推流信息失败');
    }
  } catch (error: any) {
    message.error(`获取推流信息失败: ${error.ErrorInfo || error.message || '网络错误'}`);
  } finally {
    obsModal.actionLoading = '';
  }
};

// 复制
const handleObsCopy = async (text: string, label: string) => {
  await copyText(text);
  message.success(`${label}已复制到剪贴板`);
};

// 从详情编辑
const handleEditFromDetail = () => {
  obsModalVisible.value = false;
  if (obsModal.room) {
    editingRoom.value = obsModal.room;
    isEditModalVisible.value = true;
  }
};

// 创建成功
const handleCreateSuccess = () => {
  isCreateModalVisible.value = false;
  refreshRooms();
};

// 编辑成功
const handleEditSuccess = (updatedFields: { roomName: string; coverUrl: string }) => {
  isEditModalVisible.value = false;
  if (editingRoom.value) {
    rooms.value = rooms.value.map(r => {
      if (r.RoomId === editingRoom.value?.RoomId) {
        return {
          ...r,
          RoomName: updatedFields.roomName,
          CoverURL: updatedFields.coverUrl,
        };
      }
      return r;
    });
  }
};

// 初始化
onMounted(async () => {
  try {
    const config = await getUploadConfig();
    uploadEnabled.value = config.enabled;
  } catch {}

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
        pageCursors.value = new Map(cursors);
        pageToLoad = page;
      }
    }
  } catch { /* 解析失败时回退到第1页 */ }

  loadRooms(pageToLoad);
});
</script>

<style>
/* 公共样式已从 @live-manager/common/style/room-list 引入 */
</style>
