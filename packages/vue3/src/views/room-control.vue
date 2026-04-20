<template>
  <div class="room-control-container">
    <!-- 消息提示 -->
    <div class="toast-area">
      <div v-if="successMsg" class="status-success">{{ successMsg }}</div>
      <div v-if="errorMsg" class="status-error">{{ errorMsg }}</div>
    </div>

    <!-- 顶栏 -->
    <header class="room-control-navbar">
      <div class="nav-left">
        <n-button ghost circle class="back-btn" @click="handleLeaveLive" title="返回列表">
          <template #icon><ArrowLeft /></template>
        </n-button>
        <h1>直播间详情</h1>
      </div>
      <div class="nav-right nav-right-actions">
        <div class="nav-comments-toggle" title="关闭后观众无法发送评论，对应房间 IsMessageDisabled；并广播自定义消息供观众端即时隐藏评论区">
          <span class="nav-comments-label">允许评论</span>
          <n-switch
            :value="commentsEnabled"
            :loading="commentsToggleLoading"
            :disabled="!roomInfo || liveEndedOverlayVisible"
            @update:value="handleToggleComments"
          />
        </div>
        <n-button quaternary type="error" @click="handleBanRoom">
          <template #icon><CircleStop /></template>
          强制关播
        </n-button>
      </div>
    </header>

    <!-- 主视图 -->
    <main class="room-control-viewport">
      <!-- 左侧监控区 -->
      <section class="video-monitor-area">
        <!-- 房间信息头部 -->
        <div class="room-header-external">
          <AnchorAvatar
            class-name="anchor-avatar"
            :src="roomAnchorAvatar"
            :name="roomAnchorName"
            :title="roomAnchorName"
          />
          <span class="room-title-text">
            {{ liveEndedOverlayVisible ? '直播已结束' : (currentLive?.liveName || roomInfo?.title || '正在加载...') }}
          </span>
        </div>

        <div class="video-stage">
          <!-- 虚化背景层 -->
          <div
            v-if="roomInfo?.coverUrl"
            class="video-blur-bg"
            :style="{ backgroundImage: `url(${roomInfo.coverUrl})` }"
          />
          <div v-else class="video-blur-bg-placeholder" />

          <!-- 播放器容器 -->
          <div class="player-container">
            <LiveView v-if="sdkReady" />

            <!-- 直播已结束 -->
            <div v-if="liveEndedOverlayVisible" class="live-state-overlay live-state-overlay--ended">
              <div class="live-state-overlay-content">
                <div class="live-state-overlay-title">直播已结束</div>
                <button class="live-state-overlay-btn" @click="handleLeaveLive">
                  返回直播列表
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧边栏 -->
      <aside class="right-sidebar">
        <!-- 互动面板 -->
        <div class="sidebar-interaction-card">
          <n-tabs v-model:value="activeTab" class="interaction-tabs" type="line">
            <n-tab-pane name="chat" tab="消息列表" />
            <n-tab-pane name="audience" tab="观众列表" />
          </n-tabs>

          <div class="interaction-body">
            <!-- 消息列表 -->
            <div v-show="activeTab === 'chat'" class="chat-stream-sidebar">
              <MessageList
                :muted-list="mutedList"
                :banned-list="bannedList"
                :on-mute-user="handleMuteAudience"
                :on-ban-user="handleBanAudience"
              />
            </div>

            <!-- 观众列表 -->
            <div v-show="activeTab === 'audience'" class="audience-tab-wrapper">
              <div class="audience-list-area">
                <LiveAudienceList height="99%">
                  <template #audience-mark="{ audience }">
                    <!-- 当前用户显示"我" -->
                    <span v-if="audience.userId === currentUserId" class="audience-me-tag">我</span>
                    <!-- 主播/管理员显示操作按钮 -->
                    <div v-else-if="audience.userRole !== 0 && audience.userId !== `${anchorUserId}_obs`" class="audience-row-actions">
                      <span v-if="isUserMuted(audience.userId)" class="audience-muted-badge">已禁言</span>
                      <button
                        class="audience-more-btn"
                        title="更多操作"
                        @click.stop="handleOpenAudienceDropdown($event, audience.userId, audience.userName || audience.userId, isUserMuted(audience.userId))"
                      >
                        <MoreHorizontal />
                      </button>
                    </div>
                  </template>
                </LiveAudienceList>
              </div>

              <div class="audience-bottom-actions">
                <button class="audience-bottom-btn" @click="openMutedModal">
                  已禁言观众 ({{ mutedList.length }})
                </button>
                <button class="audience-bottom-btn" @click="openBannedModal">
                  已封禁观众 ({{ bannedList.length }})
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 直播数据中控 -->
        <div class="sidebar-stats-card">
          <div class="stats-card-header">
            <h3>直播数据中控</h3>
            <div class="refresh-control-inline">
              <span class="refresh-label">自动刷新:</span>
              <n-select v-model:value="refreshInterval" :options="refreshOptions" size="small" style="width: 100px" />
            </div>
          </div>

          <div class="stats-grid-design">
            <div class="stat-item">
              <div class="stat-label">
                直播时长
                <n-tooltip placement="top">
                  <template #trigger>
                    <Info class="info-icon" />
                  </template>
                  自直播间创建至当前的实时累计时长
                </n-tooltip>
              </div>
              <div class="stat-value" :class="{ 'stat-value-small': liveDuration >= 86400 }">
                {{ formatDuration(liveDuration) }}
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label">
                实时在线人数
                <n-tooltip placement="top">
                  <template #trigger>
                    <Info class="info-icon" />
                  </template>
                  实时在线的观众人数
                </n-tooltip>
              </div>
              <div class="stat-value">{{ formatNumber(stats.onlineCount) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">
                总评论数
                <n-tooltip placement="top">
                  <template #trigger>
                    <Info class="info-icon" />
                  </template>
                  直播间累计收到的评论总数
                </n-tooltip>
              </div>
              <div class="stat-value">{{ stats.totalMsgCount.toLocaleString() }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">
                打赏总金额
                <n-tooltip placement="top">
                  <template #trigger>
                    <Info class="info-icon" />
                  </template>
                  直播期间所有用户赠送礼物的累计金额
                </n-tooltip>
              </div>
              <div class="stat-value">{{ stats.totalGiftCoins.toFixed(2) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">
                打赏次数
                <n-tooltip placement="top">
                  <template #trigger>
                    <Info class="info-icon" />
                  </template>
                  直播期间礼物赠送的总次数
                </n-tooltip>
              </div>
              <div class="stat-value">{{ stats.totalGiftsSent }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">
                打赏人数
                <n-tooltip placement="top">
                  <template #trigger>
                    <Info class="info-icon" />
                  </template>
                  直播期间赠送过礼物的独立用户数
                </n-tooltip>
              </div>
              <div class="stat-value">{{ stats.totalUniqueGiftSenders }}</div>
            </div>
          </div>
        </div>
      </aside>
    </main>

    <!-- 已禁言观众弹框 -->
    <n-modal
      v-model:show="mutedModalVisible"
      preset="card"
      title="已禁言观众"
      :style="{ width: '600px' }"
    >
      <div class="member-list-panel-modal">
        <div v-if="memberListLoading" class="member-list-empty">加载中...</div>
        <div v-else-if="mutedList.length === 0" class="member-list-empty">暂无禁言成员</div>
        <table v-else class="member-list-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>禁言解除时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in mutedList" :key="item.userId">
              <td class="member-table-user">
                <div class="member-table-user-cell">
                  <AnchorAvatar
                    class-name="member-table-avatar"
                    :src="getUserAvatar(item.userId)"
                    :name="getUserNameFromCache(item.userId)"
                  />
                  <span class="member-table-user-name" :title="getUserNameFromCache(item.userId)">{{ getUserNameFromCache(item.userId) }}</span>
                </div>
              </td>
              <td class="member-table-time">
                {{ item.endTime > 0 ? new Date(item.endTime * 1000).toLocaleString() : '-' }}
              </td>
              <td class="member-table-action">
                <n-button quaternary type="primary"  @click="handleUnmuteFromList(item.userId)">

                  解除禁言
                </n-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </n-modal>

    <!-- 已封禁观众弹框 -->
    <n-modal
      v-model:show="bannedModalVisible"
      preset="card"
      title="已封禁观众"
      :style="{ width: '600px' }"
    >
      <div class="member-list-panel-modal">
        <div v-if="memberListLoading" class="member-list-empty">加载中...</div>
        <div v-else-if="bannedList.length === 0" class="member-list-empty">暂无封禁成员</div>
        <table v-else class="member-list-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>封禁解除时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in bannedList" :key="item.userId">
              <td class="member-table-user">
                <div class="member-table-user-cell">
                  <AnchorAvatar
                    class-name="member-table-avatar"
                    :src="getUserAvatar(item.userId)"
                    :name="getUserNameFromCache(item.userId)"
                  />
                  <span class="member-table-user-name" :title="getUserNameFromCache(item.userId)">{{ getUserNameFromCache(item.userId) }}</span>
                </div>
              </td>
              <td class="member-table-time">
                {{ item.endTime > 0 ? new Date(item.endTime * 1000).toLocaleString() : '-' }}
              </td>
              <td class="member-table-action">
                <n-button quaternary type="primary" round @click="handleUnbanFromList(item.userId)">
                  解除封禁
                </n-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </n-modal>

    <!-- 确认弹窗 -->
    <n-modal
      v-model:show="confirmDialogVisible"
      preset="card"
      :title="confirmDialogTitle"
      :style="{ width: '440px' }"
      :bordered="false"
    >
      <p>{{ confirmDialogContent }}</p>
      <n-space justify="end" style="margin-top: 16px">
        <n-button @click="confirmDialogVisible = false">取消</n-button>
        <n-button type="primary" @click="handleConfirmAction">确认</n-button>
      </n-space>
    </n-modal>

    <!-- 观众操作下拉菜单（使用统一的下拉菜单组件） -->
    <Teleport to="body">
      <div
        v-if="audienceDropdown"
        ref="dropdownRef"
        class="user-action-dropdown"
        :style="{
          position: 'fixed',
          top: audienceDropdown.y + 'px',
          left: (audienceDropdown.x - 160) + 'px',
        }"
      >
        <div class="dropdown-header">
          {{ audienceDropdown.userName }}
        </div>
        <div class="dropdown-divider" />
        <button
          v-if="audienceDropdown.isMuted"
          class="dropdown-item"
          @click="handleDropdownMute"
        >
          <CheckCircle />
          解除禁言
        </button>
        <button
          v-else
          class="dropdown-item"
          @click="handleDropdownMute"
        >
          <MessageSquareOff />
          禁言
        </button>
        <button
          class="dropdown-item danger"
          @click="handleDropdownBan"
        >
          <UserCheck v-if="isUserBanned(audienceDropdown?.userId || '')" />
          <UserRoundX v-else />
          {{ isUserBanned(audienceDropdown?.userId || '') ? '解除封禁' : '封禁' }}
        </button>
        <button
          v-if="audienceDropdown && canKickAudienceUser(audienceDropdown.userId)"
          class="dropdown-item danger"
          @click="handleDropdownKickOut"
        >
          移出房间
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, inject, type Ref, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  CircleStop,
  MoreHorizontal,
  Info,
  MessageSquareOff,
  UserRoundX,
  UserCheck,
  CheckCircle,
} from 'lucide-vue-next';
import { message } from '@/utils/message';
import {
  LiveView,
  LiveAudienceList,
  useLiveListState,
  useLiveAudienceState,
  useRoomEngine,
  useLoginState,
  useLiveMonitorState,
  LiveListEvent,
} from 'tuikit-atomicx-vue3/live';
import AnchorAvatar from '@/components/AnchorAvatar.vue';
import {
  resolveAnchorAvatarUrl,
  resolveAnchorDisplayName,
} from '@/utils/anchor';
import MessageList from '@/components/MessageList.vue';
import type { RoomInfo } from '@/types';
import {
  getRoomDetail,
  getRoomStatistic,
  banRoom,
  muteMember,
  banMember,
  unmuteMember,
  unbanMember,
  getBannedMemberList,
  getMutedMemberList,
  kickUsersOutRoom,
  setRoomCommentsEnabled,
} from '@/api/room';
import {
  batchGetUserProfilePortrait,
  getCurrentUserId,
  isUrlOverrideMode,
} from '@/api/auth';
import { defaultCoverUrl } from '@live-manager/common';
import { getErrorMessage } from '@live-manager/common';
import '@live-manager/common/components/user-action-dropdown/user-action-dropdown.css';

const route = useRoute();
const router = useRouter();
const roomId = computed(() => route.params.roomId as string);

const roomEngine = useRoomEngine();
const { currentLive, leaveLive, subscribeEvent, unsubscribeEvent, joinLive } = useLiveListState();
const { audienceList, audienceCount } = useLiveAudienceState();
const { loginUserInfo, login: tuikitLogin } = useLoginState();
const { init } = useLiveMonitorState();

// 从 MainLayout inject SDK 实际使用的 userId（Vue SDK loginUserInfo 有 bug 不更新）
// inject 返回的是 Ref<string>，必须使用 .value 获取字符串
const injectedSdkUserId = inject<Ref<string>>('sdkUserId', ref(''));

// 本地管理的 SDK userId（用于 URL 覆盖模式）
const localSdkUserId = ref('');

// 当前用户ID：优先本地 SDK userId，其次 inject 的，再次 getCurrentUserId()，最后 loginUserInfo
const currentUserId = computed(() => {
  return localSdkUserId.value || injectedSdkUserId.value || getCurrentUserId() || loginUserInfo.value?.userId || '';
});

const sdkReady = ref(false);
// 标记是否已完成初始化
let hasInitialized = false;
const loading = ref(true);
const roomInfo = ref<RoomInfo | null>(null);
/** 与房间 IsMessageDisabled 相反：true 表示允许观众发评论 */
const commentsEnabled = ref(true);
const commentsToggleLoading = ref(false);
const liveEndedOverlayVisible = ref(false);
const activeTab = ref<'chat' | 'audience'>('chat');
const liveDuration = ref(0);
const createTime = ref<number | null>(null);
const successMsg = ref('');
const errorMsg = ref('');

// 禁言/封禁列表
const mutedList = ref<Array<{ userId: string; endTime: number }>>([]);
const bannedList = ref<Array<{ userId: string; endTime: number }>>([]);
const memberListLoading = ref(false);
const mutedModalVisible = ref(false);
const bannedModalVisible = ref(false);
// 用户资料缓存（用于禁言/封禁列表显示用户名）
const userProfileCache = ref<Map<string, { nick: string; avatarUrl: string }>>(new Map());

// 主播资料
const anchorProfile = ref<{ nick: string; avatarUrl: string } | null>(null);

// 统计数据
const stats = reactive({
  onlineCount: 0,
  totalViewers: 0,
  totalMsgCount: 0,
  totalLikesReceived: 0,
  totalGiftsSent: 0,
  totalGiftCoins: 0,
  totalUniqueGiftSenders: 0,
});

// 刷新选项
const refreshOptions = [
  { label: '关闭', value: 0 },
  { label: '10秒', value: 10 },
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
];
const refreshInterval = ref(30);

// 确认弹窗
const confirmDialogVisible = ref(false);
const confirmDialogTitle = ref('');
const confirmDialogContent = ref('');
const confirmAction = ref<(() => void) | null>(null);

// 计时器
let durationTimer: number | null = null;
let refreshTimer: number | null = null;

const anchorUserId = computed(
  () => currentLive.value?.liveOwner?.userId || roomInfo.value?.anchor.id || ''
);

const roomAnchorName = computed(
  () =>
    anchorProfile.value?.nick ||
    resolveAnchorDisplayName(
      currentLive.value?.liveOwner,
      roomInfo.value?.anchor.name || '未知主播'
    )
);

const roomAnchorAvatar = computed(
  () =>
    anchorProfile.value?.avatarUrl ||
    resolveAnchorAvatarUrl(currentLive.value?.liveOwner) ||
    roomInfo.value?.anchor.avatar
);

const getUserAvatar = (userId: string) => {
  const audience = audienceList.value.find((a) => a.userId === userId);
  return (audience as unknown as Record<string, unknown>)?.avatarUrl as string | undefined;
};

// 根据 userId 获取用户名称（优先使用缓存的用户资料）
const getUserNameFromCache = (userId: string) => {
  // 先从观众列表中查找
  const audience = audienceList.value.find((a) => a.userId === userId);
  if (audience?.userName) {
    return audience.userName;
  }
  // 再从缓存的用户资料中查找
  const profile = userProfileCache.value.get(userId);
  if (profile?.nick) {
    return profile.nick;
  }
  // 最后返回 userId
  return userId;
};

const showMessage = (type: 'success' | 'error', msg: string) => {
  if (type === 'success') {
    successMsg.value = msg;
    setTimeout(() => (successMsg.value = ''), 3000);
  } else {
    errorMsg.value = msg;
    setTimeout(() => (errorMsg.value = ''), 3000);
  }
};

// 获取错误码和错误信息
const getErrorInfo = (error: any): { code: number; info: string } => {
  const code = error?.ErrorCode || error?.errorCode || error?.code || 0;
  const info = error?.ErrorInfo || error?.errorInfo || '';
  return { code, info };
};

const formatNumber = (num: number) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  return num.toLocaleString();
};

const formatDuration = (seconds: number) => {
  if (seconds < 0) seconds = 0;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const hms = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return days > 0 ? `${days}天 ${hms}` : hms;
};

const handleLeaveLive = async () => {
  try {
    await leaveLive();
    router.back();
  } catch (error) {
    console.error('Failed to leave live:', error);
  }
};

const handleToggleComments = async (enabled: boolean) => {
  if (!roomId.value || !roomInfo.value || liveEndedOverlayVisible.value) return;
  commentsToggleLoading.value = true;
  try {
    const { updateResult, signalResult } = await setRoomCommentsEnabled(roomId.value, enabled);
    const mainCode = updateResult?.ErrorCode ?? (updateResult as { Error?: number })?.Error ?? -1;
    if (mainCode !== 0) {
      const info = updateResult?.ErrorInfo || '更新房间失败';
      showMessage('error', getErrorMessage(mainCode, info));
      return;
    }
    roomInfo.value.isMessageDisabled = !enabled;
    commentsEnabled.value = enabled;
    const sigCode = signalResult?.ErrorCode ?? (signalResult as { Error?: number })?.Error ?? 0;
    if (sigCode !== 0 && signalResult) {
      message.warning('房间已更新，但通知观众端的自定义消息发送失败，观众可依赖进房拉取房间信息刷新');
    } else {
      message.success(enabled ? '已开放评论' : '已关闭评论');
    }
  } catch (error: any) {
    const { code, info } = getErrorInfo(error);
    const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
    showMessage('error', `操作失败: ${msg}`);
  } finally {
    commentsToggleLoading.value = false;
  }
};

const canKickAudienceUser = (userId: string) => {
  if (!userId || userId === anchorUserId.value) return false;
  if (userId === `${anchorUserId.value}_obs`) return false;
  return true;
};

const handleBanRoom = () => {
  confirmDialogTitle.value = '确认要强制关播吗？';
  confirmDialogContent.value = '强制关播后，该直播间会被解散。';
  confirmAction.value = async () => {
    if (!roomInfo.value) return;
    try {
      await banRoom(roomInfo.value.id);
      showMessage('success', '房间已封禁');
      message.success('该直播间已被强制关播');
      confirmDialogVisible.value = false;
      router.back();
    } catch (error: any) {
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
      showMessage('error', `封禁失败: ${msg}`);
      confirmDialogVisible.value = false;
    }
  };
  confirmDialogVisible.value = true;
};

const handleConfirmAction = () => {
  confirmAction.value?.();
};

// 禁言观众
const handleMuteAudience = (userId: string, userName: string, isMuted: boolean) => {
  if (!roomId.value) return;
  // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行禁言
  if (userId === `${anchorUserId.value}_obs`) return;

  if (isMuted) {
    confirmDialogTitle.value = '确定要解除该用户禁言？';
    confirmDialogContent.value = `确认解除「${userName}」的禁言吗？`;
    confirmAction.value = async () => {
      try {
        await unmuteMember(roomId.value, [userId]);
        showMessage('success', `已解除「${userName}」的禁言`);
        fetchMutedList();
      } catch (error: any) {
        const { code, info } = getErrorInfo(error);
        const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
        showMessage('error', `操作失败: ${msg}`);
      } finally {
        confirmDialogVisible.value = false;
      }
    };
  } else {
    confirmDialogTitle.value = '确定要禁言该用户？';
    confirmDialogContent.value = `禁言后该用户将在 10 分钟内无法发送弹幕消息，确认禁言「${userName}」吗？`;
    confirmAction.value = async () => {
      try {
        await muteMember(roomId.value, [userId], 600);
        showMessage('success', `已禁言「${userName}」`);
        fetchMutedList();
      } catch (error: any) {
        const { code, info } = getErrorInfo(error);
        const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
        showMessage('error', `禁言失败: ${msg}`);
      } finally {
        confirmDialogVisible.value = false;
      }
    };
  }
  confirmDialogVisible.value = true;
};

// 封禁观众
const handleBanAudience = (userId: string, userName: string, isBanned: boolean) => {
  if (!roomId.value) return;
  // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行封禁
  if (userId === `${anchorUserId.value}_obs`) return;

  if (isBanned) {
    confirmDialogTitle.value = '解除封禁';
    confirmDialogContent.value = `确认取消「${userName}」的封禁吗？`;
    confirmAction.value = async () => {
      try {
        await unbanMember(roomId.value, [userId]);
        showMessage('success', `已取消「${userName}」的封禁`);
        fetchBannedList();
      } catch (error: any) {
        const { code, info } = getErrorInfo(error);
        const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
        showMessage('error', `操作失败: ${msg}`);
      } finally {
        confirmDialogVisible.value = false;
      }
    };
  } else {
    confirmDialogTitle.value = '确认要封禁该用户？';
    confirmDialogContent.value = `封禁后该用户将在 1 小时内无法进入房间，确认封禁「${userName}」吗？`;
    confirmAction.value = async () => {
      try {
        await banMember(roomId.value, [userId], 3600, '管理员封禁');
        showMessage('success', `已封禁「${userName}」`);
        fetchBannedList();
      } catch (error: any) {
        const { code, info } = getErrorInfo(error);
        const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
        showMessage('error', `封禁失败: ${msg}`);
      } finally {
        confirmDialogVisible.value = false;
      }
    };
  }
  confirmDialogVisible.value = true;
};

// 获取禁言列表
const fetchMutedList = async () => {
  if (!roomId.value) return;
  memberListLoading.value = true;
  try {
    const res = await getMutedMemberList(roomId.value);
    const mutedAccountList = res.Response?.MutedAccountList || res.MutedAccountList || [];
    mutedList.value = mutedAccountList.map((m: any) => ({
      userId: m.Member_Account,
      endTime: m.MutedUntil || 0,
    }));

    // 批量获取用户资料
    const userIds = mutedList.value.map(item => item.userId).filter(Boolean);
    if (userIds.length > 0) {
      try {
        const profileMap = await batchGetUserProfilePortrait(userIds);
        userProfileCache.value = new Map([...userProfileCache.value, ...profileMap]);
      } catch {
        // 获取禁言用户资料失败，静默忽略
      }
    }
  } catch (error: any) {
    console.error('获取禁言列表失败:', error);
  } finally {
    memberListLoading.value = false;
  }
};

// 获取封禁列表
const fetchBannedList = async () => {
  if (!roomId.value) return;
  memberListLoading.value = true;
  try {
    const res = await getBannedMemberList(roomId.value);
    const bannedAccountList = res.Response?.BannedAccountList || res.BannedAccountList || [];
    bannedList.value = bannedAccountList.map((m: any) => ({
      userId: m.Member_Account,
      endTime: m.BannedUntil || 0,
    }));

    // 批量获取用户资料
    const userIds = bannedList.value.map(item => item.userId).filter(Boolean);
    if (userIds.length > 0) {
      try {
        const profileMap = await batchGetUserProfilePortrait(userIds);
        userProfileCache.value = new Map([...userProfileCache.value, ...profileMap]);
      } catch {
        // 获取封禁用户资料失败，静默忽略
      }
    }
  } catch (error: any) {
    console.error('获取封禁列表失败:', error);
  } finally {
    memberListLoading.value = false;
  }
};

const openMutedModal = () => {
  fetchMutedList();
  mutedModalVisible.value = true;
};

const openBannedModal = () => {
  fetchBannedList();
  bannedModalVisible.value = true;
};

const isUserMuted = (userId: string): boolean => {
  return mutedList.value.some((m) => m.userId === userId);
};

const isUserBanned = (userId: string): boolean => {
  return bannedList.value.some((b) => b.userId === userId);
};

const handleUnmuteFromList = (userId: string) => {
  if (!roomId.value) return;
  confirmDialogTitle.value = '解除禁言';
  confirmDialogContent.value = `确认取消「${userId}」的禁言吗？`;
  confirmAction.value = async () => {
    try {
      await unmuteMember(roomId.value, [userId]);
      showMessage('success', `已取消「${userId}」的禁言`);
      fetchMutedList();
    } catch (error: any) {
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
      showMessage('error', `操作失败: ${msg}`);
    } finally {
      confirmDialogVisible.value = false;
    }
  };
  confirmDialogVisible.value = true;
};

const handleUnbanFromList = (userId: string) => {
  if (!roomId.value) return;
  confirmDialogTitle.value = '解除封禁';
  confirmDialogContent.value = `确认解除「${userId}」的封禁吗？`;
  confirmAction.value = async () => {
    try {
      await unbanMember(roomId.value, [userId]);
      showMessage('success', `已解除「${userId}」的封禁`);
      fetchBannedList();
    } catch (error: any) {
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
      showMessage('error', `操作失败: ${msg}`);
    } finally {
      confirmDialogVisible.value = false;
    }
  };
  confirmDialogVisible.value = true;
};

// 观众操作下拉菜单状态（点击触发，与 React 版本一致）
const audienceDropdown = ref<{
  userId: string;
  userName: string;
  isMuted: boolean;
  x: number;
  y: number;
} | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);

const handleOpenAudienceDropdown = (
  e: MouseEvent,
  userId: string,
  userName: string,
  isMuted: boolean
) => {
  e.stopPropagation();
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  audienceDropdown.value = {
    userId,
    userName,
    isMuted,
    x: rect.right,
    y: rect.bottom + 4,
  };
};

const closeAudienceDropdown = () => {
  audienceDropdown.value = null;
};

const handleDropdownMute = () => {
  if (!audienceDropdown.value) return;
  const { userId, userName, isMuted } = audienceDropdown.value;
  handleMuteAudience(userId, userName, isMuted);
  closeAudienceDropdown();
};

const handleDropdownBan = () => {
  if (!audienceDropdown.value) return;
  const { userId, userName } = audienceDropdown.value;
  handleBanAudience(userId, userName, false);
  closeAudienceDropdown();
};

const handleDropdownKickOut = () => {
  if (!audienceDropdown.value || !roomId.value) return;
  const { userId, userName } = audienceDropdown.value;
  if (!canKickAudienceUser(userId)) {
    closeAudienceDropdown();
    return;
  }
  confirmDialogTitle.value = '移出房间';
  confirmDialogContent.value = `将「${userName || userId}」移出当前直播间？该用户需重新进入才能观看。`;
  confirmAction.value = async () => {
    try {
      const res = await kickUsersOutRoom(roomId.value, [userId], '管理员移出房间');
      const code = res?.ErrorCode ?? (res as { Error?: number })?.Error ?? -1;
      if (code !== 0) {
        const info = res?.ErrorInfo || '';
        showMessage('error', getErrorMessage(code, info));
      } else {
        message.success('已移出房间');
        showMessage('success', `已移出「${userName || userId}」`);
      }
    } catch (error: any) {
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
      showMessage('error', `移出失败: ${msg}`);
    } finally {
      confirmDialogVisible.value = false;
    }
  };
  confirmDialogVisible.value = true;
  closeAudienceDropdown();
};

// 点击外部关闭下拉菜单
const handleClickOutsideDropdown = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    closeAudienceDropdown();
  }
};

watch(() => audienceDropdown.value, (val) => {
  if (val) {
    document.addEventListener('mousedown', handleClickOutsideDropdown);
  } else {
    document.removeEventListener('mousedown', handleClickOutsideDropdown);
  }
});

// 获取房间信息
const fetchRoomInfo = async () => {
  if (!roomId.value) return;
  try {
    const roomResponse = await getRoomDetail(roomId.value);

    if (roomResponse.ErrorCode === 0 && roomResponse.Response?.RoomInfo) {
      const item = roomResponse.Response.RoomInfo;
      const anchorName = resolveAnchorDisplayName(item, item.Owner_Account || '-');
      const anchorAvatar = resolveAnchorAvatarUrl(item);

      const ownerAccount = item.Owner_Account;
      if (ownerAccount) {
        batchGetUserProfilePortrait([ownerAccount])
          .then((profileMap) => {
            const profile = profileMap.get(ownerAccount);
            if (profile) {
              anchorProfile.value = {
                nick: profile.nick || '',
                avatarUrl: profile.avatarUrl || '',
              };
            }
          })
          .catch(() => { /* 获取主播资料失败，静默忽略 */ });
      }

      roomInfo.value = {
        id: item.RoomId,
        title: item.RoomName || '未命名房间',
        coverUrl: item.CoverURL || defaultCoverUrl,
        anchor: {
          id: item.Owner_Account,
          name: anchorName,
          avatar: anchorAvatar,
        },
        onlineCount: 0,
        createdAt: item.CreateTime * 1000,
        isMessageDisabled: item.IsMessageDisabled === true,
        roomType: item.RoomType || 'Live',
        isSeatEnabled: item.IsSeatEnabled || false,
        takeSeatMode: item.TakeSeatMode || 'FreeToTake',
        maxSeatCount: item.MaxSeatCount || 9,
        maxMemberCount: item.MaxMemberCount || 1000,
        category: item.Tags || [],
        activityStatus: item.ActivityStatus || 1,
        isPublicVisible: item.IsPublicVisibled !== undefined ? item.IsPublicVisibled : true,
        notice: item.Notice || '',
        isLikeEnabled: item.IsThumbsEnabled !== undefined ? item.IsThumbsEnabled : true,
      };

      commentsEnabled.value = item.IsMessageDisabled !== true;

      const roomCreateTime = item.CreateTime ? item.CreateTime * 1000 : null;
      createTime.value = roomCreateTime;
      if (roomCreateTime) {
        const currentDuration = Math.floor((Date.now() - roomCreateTime) / 1000);
        liveDuration.value = currentDuration > 0 ? currentDuration : 0;
      }
    } else if (roomResponse.ErrorCode !== 0) {
      // 只有当房间确实不存在时才显示直播已结束（错误码 100004）
      // 其他错误码只显示错误信息，但仍然允许进入直播间
      if (roomResponse.ErrorCode === 100004) {
        liveEndedOverlayVisible.value = true;
      }
      const errorInfo = roomResponse.ErrorInfo || '';
      showMessage('error', getErrorMessage(roomResponse.ErrorCode, errorInfo));
    } else {
      showMessage('error', getErrorMessage(roomResponse.ErrorCode, roomResponse.ErrorInfo, '获取房间信息失败'));
    }
  } catch (error: any) {
    // 网络错误也可能导致房间访问失败
    const { code, info } = getErrorInfo(error);
    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      showMessage('error', '网络错误，请检查网络连接');
    } else {
      const msg = code ? getErrorMessage(code, info) : (error.message || '未知错误');
      showMessage('error', `请求失败: ${msg}`);
    }
  } finally {
    loading.value = false;
  }
};

// 获取统计数据
const fetchStats = async () => {
  if (!roomId.value) return;
  try {
    const statsResponse = await getRoomStatistic(roomId.value);
    if (statsResponse.ErrorCode === 0 && statsResponse.Response) {
      const d = statsResponse.Response;
      stats.totalViewers = d.TotalViewers || 0;
      stats.totalMsgCount = d.TotalMsgCount || 0;
      stats.totalLikesReceived = d.TotalLikesReceived || 0;
      stats.totalGiftsSent = d.TotalGiftsSent || 0;
      stats.totalGiftCoins = d.TotalGiftCoins || 0;
      stats.totalUniqueGiftSenders = d.TotalUniqueGiftSenders || 0;
    }
  } catch (error: any) {
    console.error('获取统计数据失败:', error.message);
  }
};

// 监听 SDK 就绪 - 使用 getter 函数监听 roomEngine.instance
watch(
  () => roomEngine.instance,
  (instance) => {
    console.log('[RoomControl] roomEngine.instance 变化:', instance);
    sdkReady.value = Boolean(instance);
  },
  { immediate: true }
);

// 主播视频状态
const handleLiveEnded = () => {
  // 清除直播时长定时器，防止直播结束后时长还在跳动
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
  liveEndedOverlayVisible.value = true;
};

// 加载禁言和封禁列表
const loadMutedAndBannedLists = () => {
  if (roomId.value) {
    fetchMutedList();
    fetchBannedList();
  }
};

// 初始化
const checkAndInitSDK = async () => {
  if (hasInitialized) return;

  // URL 覆盖模式：需要先初始化 SDK
  if (isUrlOverrideMode() && !roomEngine.instance) {
    // 从 localStorage 读取凭证（MainLayout 已调用 login API 获取并保存）
    const storedUserId = localStorage.getItem('user_id');
    const storedUserSig = localStorage.getItem('user_sig');
    const storedSdkAppId = localStorage.getItem('sdk_app_id');

    if (storedUserId && storedUserSig && storedSdkAppId) {
      localSdkUserId.value = storedUserId;
      console.log('[RoomControl] URL override mode, initializing SDK with userId:', storedUserId);

      try {
        init({
          baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api',
          account: {
            sdkAppId: Number(storedSdkAppId),
            userId: storedUserId,
            password: storedUserSig,
          },
        });

        await tuikitLogin({
          userId: storedUserId,
          userSig: storedUserSig,
          sdkAppId: Number(storedSdkAppId),
        });
        console.log('[RoomControl] TUILogin success, userId:', storedUserId);
      } catch (err: any) {
        // 错误码 2025 表示重复登录
        if (err?.code === 2025 || err?.message?.includes('重复登录')) {
          console.log('[RoomControl] Already logged in');
        } else {
          console.error('[RoomControl] SDK init error:', err);
          return;
        }
      }
    } else {
      console.warn('[RoomControl] URL override mode but no credentials in localStorage');
    }
  }

  const instance = roomEngine.instance;
  console.log('[RoomControl] checkAndInitSDK:', Boolean(instance), 'roomId:', roomId.value);
  if (roomId.value && instance) {
    hasInitialized = true;
    sdkReady.value = true;
    // 加载禁言和封禁列表
    loadMutedAndBannedLists();
    // 处理加入直播间失败的情况
    joinLive({ liveId: roomId.value }).catch((error: any) => {
      const errorCode = error?.errorCode || error?.code;
      const errorInfo = error?.errorInfo || error?.info;
      if (errorCode) {
        liveEndedOverlayVisible.value = true;
        showMessage('error', getErrorMessage(errorCode, errorInfo));
      } else {
        console.error('加入直播间失败:', error);
      }
    });
    fetchRoomInfo();
    fetchStats();

    durationTimer = window.setInterval(() => {
      if (createTime.value) {
        const currentDuration = Math.floor((Date.now() - createTime.value) / 1000);
        liveDuration.value = currentDuration > 0 ? currentDuration : 0;
      }
    }, 1000);

    subscribeEvent(LiveListEvent.onLiveEnded, handleLiveEnded);
  }
};

// 立即检查一次（组件挂载时）
checkAndInitSDK();

// 如果还没初始化，使用定时器轮询检查（因为 roomEngine.instance 可能不是响应式的）
const sdkCheckTimer = setInterval(() => {
  if (!hasInitialized) {
    checkAndInitSDK();
  } else {
    clearInterval(sdkCheckTimer);
  }
}, 500);

// 监听 sdkReady 变化，当变成 true 时执行初始化
watch(sdkReady, (ready) => {
  console.log('[RoomControl] sdkReady watch 触发:', ready, 'roomId:', roomId.value, 'hasInitialized:', hasInitialized);
  if (ready && roomId.value && !hasInitialized) {
    hasInitialized = true;
    console.log('[RoomControl] 执行初始化逻辑');
    // 加载禁言和封禁列表
    loadMutedAndBannedLists();
    // 处理加入直播间失败的情况
    joinLive({ liveId: roomId.value }).catch((error: any) => {
      const errorCode = error?.errorCode || error?.code;
      const errorInfo = error?.errorInfo || error?.info;
      if (errorCode) {
        liveEndedOverlayVisible.value = true;
        showMessage('error', getErrorMessage(errorCode, errorInfo));
      } else {
        console.error('加入直播间失败:', error);
      }
    });
    fetchRoomInfo();
    fetchStats();

    durationTimer = window.setInterval(() => {
      if (createTime.value) {
        const currentDuration = Math.floor((Date.now() - createTime.value) / 1000);
        liveDuration.value = currentDuration > 0 ? currentDuration : 0;
      }
    }, 1000);

    subscribeEvent(LiveListEvent.onLiveEnded, handleLiveEnded);
  }
});

// 监听刷新间隔
watch(refreshInterval, (interval) => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (interval > 0 && roomId.value && sdkReady.value) {
    refreshTimer = window.setInterval(fetchStats, interval * 1000);
  }
});

// 同步观众数
watch(audienceCount, (count) => {
  stats.onlineCount = count;
});

// 进入观众列表 tab 时获取禁言列表和封禁列表
let audienceNameObserver: MutationObserver | null = null;

watch(activeTab, (tab) => {
  if (tab === 'audience' && roomId.value) {
    loadMutedAndBannedLists();

    // 为 SDK 观众列表中的用户名添加 title 属性（实现原生 tooltip）
    // Vue SDK 使用 .viewer-name（不同于 React SDK 的 .uikit-liveAudienceList__name）
    const addTitles = () => {
      const nameElements = document.querySelectorAll('.viewer-name');
      nameElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.textContent || '';
        if (htmlEl.title !== text) {
          htmlEl.title = text;
        }
      });
    };

    // 延迟执行，等 DOM 渲染完成
    setTimeout(() => {
      addTitles();
      const container = document.querySelector('.audience-list-area');
      if (container) {
        audienceNameObserver?.disconnect();
        audienceNameObserver = new MutationObserver(addTitles);
        audienceNameObserver.observe(container, { childList: true, subtree: true });
      }
    }, 100);
  } else {
    // 离开观众列表 tab 时清理 observer
    audienceNameObserver?.disconnect();
    audienceNameObserver = null;
  }
});

onUnmounted(() => {
  if (durationTimer) {
    clearInterval(durationTimer);
  }
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  audienceNameObserver?.disconnect();
  audienceNameObserver = null;
  document.removeEventListener('mousedown', handleClickOutsideDropdown);
  unsubscribeEvent(LiveListEvent.onLiveEnded, handleLiveEnded);
  leaveLive().catch((err) => {
    console.error('退出房间失败:', err);
  });
});
</script>

<style scoped>
.room-control-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F5F7FA;
}

.toast-area {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.status-success,
.status-error {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 8px;
  animation: fadeIn 0.3s;
}

.status-success {
  background: #E8F5E9;
  color: #2E7D32;
}

.status-error {
  background: #FFEBEE;
  color: #C62828;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 顶栏 */
.room-control-navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 56px;
  padding: 0 16px 0 0;
  background: transparent;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-left h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  color: #22262E;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
}

.back-btn {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  min-height: 36px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: white !important;
  border: 1px solid #ECEFF6 !important;
  border-radius: 10px !important;
  cursor: pointer;
  color: #22262E !important;
  padding: 0 !important;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #F5F7FA;
}

.nav-right {
  display: flex;
  gap: 20px;
}

.nav-right-actions {
  align-items: center;
}

.nav-comments-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 8px;
  background: #f5f7fa;
}

.nav-comments-label {
  font-size: 13px;
  color: #4e5969;
  white-space: nowrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 6px;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(229, 69, 69, 0.1);
}

.danger-text {
  color: #E54545;
}

/* 主视图 */
.room-control-viewport {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  min-height: 0;
  overflow: hidden; background-color: white;
  border-radius: 12px;
}

/* 左侧监控区 */
.video-monitor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 24px;
  background: #fff;
}

.room-header-external {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.anchor-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
}

.room-title-text {
  font-size: 16px;
  font-weight: 500;
  color: #1D2129;
}

.video-stage {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  background: #2a2a2a;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 400px;
}

.video-blur-bg {
  position: absolute;
  inset: 0;
  filter: blur(30px) brightness(0.4);
  transform: scale(1.2);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.video-blur-bg-placeholder {
  position: absolute;
  inset: 0;
  background: #2a2a2a;
  z-index: 0;
}

.player-container {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  min-height: 0;
  z-index: 1;
  background: transparent;
}

.player-container > :deep(*) {
  background-color: transparent !important;
}

/* 隐藏 SDK LiveView 内部的播放控制条 */
.player-container :deep(.playback-controls) {
  display: none !important;
}

.live-state-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.live-state-overlay--ended {
  background: rgba(0, 0, 0, 0.8);
}

.live-state-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  color: #fff;
  text-align: center;
}

.live-state-overlay-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.live-state-overlay-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 1px;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.live-state-overlay-btn {
  border: 2px solid rgba(60, 124, 255, 0.95);
  background: rgba(22, 40, 88, 0.18);
  color: #3b7cff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.live-state-overlay-btn:hover {
  color: #6d9eff;
  border-color: #6d9eff;
  background: rgba(32, 62, 136, 0.22);
}

/* 右侧边栏 */
.right-sidebar {
  width: 380px;
  border-left: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  background: #fff;
  flex-shrink: 0;
}

.sidebar-interaction-card {
  height: 50%;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #f0f0f0;
}

.interaction-tabs {
  padding: 12px 16px 0;
}

.interaction-tabs :deep(.t-tabs__header) {
  border-bottom: none;
}

.interaction-tabs :deep(.t-tabs__nav) {
  background: transparent !important;
}

.interaction-tabs :deep(.t-tabs__content) {
  display: none;
}

.interaction-tabs :deep(.t-tabs__nav-item) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 8px 0;
  font-size: 13px;
  color: #86909C !important;
  position: relative;
  margin-right: 16px;
}

.interaction-tabs :deep(.t-tabs__nav-item:hover) {
  background: transparent !important;
  color: #1D2129 !important;
}

.interaction-tabs :deep(.t-tabs__nav-item.t-is-active) {
  color: #1D2129 !important;
  font-weight: 600;
  background: transparent !important;
}

.interaction-tabs :deep(.t-tabs__nav-item.t-is-active::after) {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #1C66E5;
}

.interaction-tabs :deep(.t-tabs__bar) {
  display: none;
}

.tab-count {
  font-size: 12px;
  background: #f0f0f0;
  border-radius: 8px;
  padding: 0 6px;
  line-height: 18px;
  font-weight: 400;
  margin-left: 4px;
}

.interaction-tabs :deep(.t-tabs__nav-item.t-is-active .tab-count) {
  background: #e6f0ff;
  color: #1C66E5;
}

.interaction-body {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-stream-sidebar {
  height: 100%;
}

.audience-tab-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.audience-list-area {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 隐藏 SDK 自带的底部当前用户条 */
:deep(.current-user-item) {
  display: none !important;
}

/* 观众列表面板去掉灰色背景 */
:deep(.viewers-panel) {
  background: transparent !important;
}

/* 观众列表项样式：添加 position: relative 和右侧 padding 为操作区域留出空间 */
/* Vue SDK 使用 .viewer-item / .viewer-name（不同于 React SDK 的 uikit-liveAudienceList__xxx） */
:deep(.viewer-item) {
  position: relative;
  padding-right: 100px !important;
}

/* 确保观众名字截断生效 */
:deep(.viewer-name) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* "我"标签样式 */
.audience-me-tag {
  font-size: 11px;
  background: #1C66E5;
  color: #fff;
  padding: 0 6px;
  border-radius: 10px;
  line-height: 18px;
  position: absolute;
  right: 8px;
  flex-shrink: 0;
}

.audience-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  position: absolute;
  right: 8px;
  flex-shrink: 0;
}

.audience-muted-badge {
  font-size: 11px;
  color: #E54545;
  background: #FFF1F0;
  padding: 1px 8px;
  border-radius: 4px;
  line-height: 18px;
  white-space: nowrap;
  font-weight: 500;
}

.audience-banned-badge {
  font-size: 11px;
  color: #E54545;
  background: #FFF1F0;
  padding: 1px 8px;
  border-radius: 4px;
  line-height: 18px;
  white-space: nowrap;
  font-weight: 500;
}

.audience-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px !important;
  height: 28px !important;
  border: none !important;
  background: transparent !important;
  color: #86909C;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  padding: 0 !important;
  flex-shrink: 0;
}

.audience-more-btn:hover {
  background: #f0f0f0 !important;
  color: #1D2129;
}

.audience-bottom-actions {
  display: flex;
  gap: 12px;
  padding: 12px 0 0;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.audience-bottom-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: #F2F3F5;
  color: #4E5969;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.audience-bottom-btn:hover {
  background: #E5E6EB;
  color: #1D2129;
}

/* 统计卡片 */
.sidebar-stats-card {
  flex: 1;
  padding: 20px 16px;
  overflow-y: auto;
  background: #fff;
}

.stats-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stats-card-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
}

.refresh-control-inline {
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-label {
  font-size: 12px;
  color: #86909C;
  white-space: nowrap;
}

.stats-grid-design {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: #f0f0f0;
  border: 1px solid #f0f0f0;
}

.stat-item {
  background: #fff;
  padding: 16px;
}

.stat-label {
  font-size: 13px;
  color: #86909C;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.info-icon {
  opacity: 0.5;
  cursor: pointer;
  flex-shrink: 0;
}

.info-icon:hover {
  opacity: 0.8;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1D2129;
}

.stat-value-small {
  font-size: 18px;
}

.stat-value small {
  font-size: 14px;
  font-weight: 400;
  margin-left: 2px;
}

/* 禁言/封禁列表弹窗 */
.member-list-panel-modal {
  max-height: 400px;
  overflow-x: auto;
  overflow-y: auto;
  box-sizing: border-box;
}

.member-list-empty {
  padding: 40px;
  text-align: center;
  color: #86909C;
}

.member-list-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.member-list-table th,
.member-list-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #E6E9F0;
}

.member-list-table th {
  font-size: 12px;
  font-weight: 500;
  color: #86909C;
  background: #F5F7FA;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-list-table th:first-child {
  width: 40%;
}

.member-list-table th:nth-child(2) {
  width: 35%;
}

.member-list-table th:nth-child(3) {
  width: 25%;
}

.member-list-table td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-table-user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.member-table-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
  display: inline-block;
}

.member-table-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.member-table-time {
  font-size: 13px;
  color: #4E5969;
}
</style>

<!-- 非 scoped 样式：下拉菜单样式已移至 @live-manager/common/components/user-action-dropdown/user-action-dropdown.css -->
<style>
/* 下拉菜单样式已统一到 common 包 */
</style>
