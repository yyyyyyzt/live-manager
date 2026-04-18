<template>
  <div class="live-monitor-page">
    <div class="monitor-header">
      <div class="monitor-title-section">
        <h2 class="monitor-title">直播监控</h2>
      </div>
      <div class="monitor-header-actions">
        <!-- 搜索框 -->
        <n-input
          v-model:value="searchInput"
          placeholder="输入房间 ID 搜索"
          class="monitor-search-input"
          clearable
          :status="getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES ? 'error' : undefined"
          @keyup.enter="handleSearch()"
          @clear="handleClearSearch"
        >
          <template #suffix>
            <Search :size="18" style="cursor: pointer" @click="() => handleSearch()" />
          </template>
        </n-input>
        <!-- 刷新按钮 -->
        <n-button
          type="primary" ghost
          round
          :loading="refreshing"
          @click="handleRefresh"
        >
          <template #icon>
            <RefreshCw :size="18" />
          </template>
          刷新
        </n-button>
      </div>
    </div>

    <div class="live-monitor-grid">
      <template v-if="loading">
        <div class="monitor-loading">
          <div class="loading-spinner" />
          <span>加载中...</span>
        </div>
      </template>
      <template v-else-if="!hasRoomData">
        <div class="monitor-empty">
          <div class="empty-icon">
            <Maximize2 :size="48" :stroke-width="1" />
          </div>
          <p>暂无直播间</p>
        </div>
      </template>
      <template v-else>
        <div
          v-for="item in monitorLiveInfoList"
          :key="item.liveId"
          :class="['live-card', { hovered: hoveredCardId === item.liveId }]"
          @mouseenter="hoveredCardId = item.liveId"
          @mouseleave="hoveredCardId = null"
        >
          <div :id="item.liveId" class="live-video-container">
            <div
              class="live-video-bg"
              :style="{
                backgroundImage: `url(${item.backgroundUrl || item.coverUrl || defaultCoverUrl})`
              }"
            />
            <div
              :id="`live_monitor_view_${item.liveId}`"
              class="live-video-player"
            />

            <div class="live-id-badge">
              <span :title="item.liveId">房间ID: {{ item.liveId }}</span>
            </div>

            <div class="live-video-overlay" @click.stop="handleClickDetails(item.liveId)">
              <div class="overlay-btn primary">
                <Maximize2 :size="18" />
                查看详情
              </div>
            </div>

            <template v-if="isFullscreen && fullscreenLiveId === item.liveId">
              <button class="fullscreen-close" @click="exitFullscreen">
                <X :size="20" />
              </button>
              <button class="fullscreen-mute" @click="toggleMuteAudio(item.liveId)">
                <VolumeX v-if="isMuted" :size="20" />
                <Volume2 v-else :size="20" />
              </button>
            </template>
          </div>

          <div class="live-card-info">
            <div class="live-card-title" :title="item.liveName || '未命名直播间'">
              {{ item.liveName || '未命名直播间' }}
            </div>
            <div class="live-card-meta">
              <div class="live-card-anchor">
                <AnchorAvatar
                  class-name="anchor-avatar"
                  :src="getAnchorAvatar(item)"
                  :name="getAnchorName(item)"
                  :title="getAnchorName(item)"
                />
                <span class="anchor-name" :title="getAnchorName(item)">{{ getAnchorName(item) }}</span>
              </div>
              <span class="meta-viewer-count" :title="String(item.currentViewerCount)">
                {{ item.currentViewerCount || 0 }}次观看
              </span>
            </div>
          </div>

          <div :class="['live-card-actions', { show: hoveredCardId === item.liveId }]">
            <n-button
              class="action-btn close full"
              quaternary
              @click.stop="handleCloseLive(item.liveId, item.liveName || '未命名直播间')"
            >
              <template #icon>
                  <CircleStop :size="18" />
              </template>
              <span>强制关播</span>
            </n-button>
          </div>
        </div>
      </template>
    </div>

    <div class="live-monitor-pagination">
      <n-button ghost
        size="small"
        :disabled="currentPage <= 1 || loading"
        @click="switchPage(1)"
      >
        首页
      </n-button>
      <n-button ghost
        size="small"
        :disabled="currentPage <= 1 || loading"
        @click="switchPage(currentPage - 1)"
      >
        上一页
      </n-button>
      <span class="page-info">第 {{ currentPage }} 页</span>
      <n-button ghost
        size="small"
        :disabled="!hasMoreData || loading"
        @click="switchPage(currentPage + 1)"
      >
        下一页
      </n-button>
    </div>

    <!-- 强制关播确认弹窗 -->
    <n-modal
      v-model:show="closeConfirm.visible"
      preset="card"
      title="确认要强制关播吗？"
      :style="{ width: '400px', maxWidth: '95vw' }"
      :mask-closable="!closeConfirm.closing"
    >
      <p>强制关播后，该直播间会被解散。</p>
      <n-space justify="end" style="margin-top: 16px">
        <n-button ghost round :disabled="closeConfirm.closing" @click="handleCancelClose">取消</n-button>
        <n-button type="primary" round :loading="closeConfirm.closing" @click="handleConfirmClose">
          {{ closeConfirm.closing ? '关播中...' : '确认' }}
        </n-button>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject } from 'vue';
import { useRouter } from 'vue-router';
import { CircleStop, X, Volume2, VolumeX, Maximize2, Search, RefreshCw } from 'lucide-vue-next';
import { message } from '@/utils/message';
import { useLiveMonitorState } from 'tuikit-atomicx-vue3/live';
import { createBasicAccount, batchGetUserProfilePortrait, type UserPortraitProfile } from '@/api/auth';
import { getRoomDetail, getRoomList } from '@/api/room';
import { getErrorMessage, getByteLength, ROOM_SEARCH_MAX_BYTES } from '@live-manager/common';
import { resolveAnchorAvatarUrl, resolveAnchorDisplayName } from '@/utils/anchor';
import AnchorAvatar from '@/components/AnchorAvatar.vue';
import { defaultCoverUrl } from '@live-manager/common';
import '@live-manager/common/style/live-monitor.css';
import type { Ref } from 'vue';

const router = useRouter();

const { init, startPlay, stopPlay, closeRoom, muteLiveAudio, monitorLiveInfoList } = useLiveMonitorState();

// 从 MainLayout 注入 SDK 就绪状态
const sdkReady = inject<Ref<boolean>>('sdkReady');

const currentPage = ref(1);
const hasMoreData = ref(true);
const isFullscreen = ref(false);
const isMuted = ref(true);
const fullscreenLiveId = ref('');
const loading = ref(true);
const hasRoomData = ref(false);
const hoveredCardId = ref<string | null>(null);

const closeConfirm = ref<{
  visible: boolean;
  liveId: string;
  liveName: string;
  closing: boolean;
}>({
  visible: false,
  liveId: '',
  liveName: '',
  closing: false,
});

const searchInput = ref('');
const searching = ref(false);
const isSearchMode = ref(false);

const pageSize = 8;

// 用户资料缓存
const userProfileMap = ref<Map<string, UserPortraitProfile>>(new Map());

// 分页数据缓存
const pageDataCache = ref<Map<number, any[]>>(new Map());
const pageCursors = ref<Map<number, string>>(new Map([[1, '']]));
const pageHasMore = ref<Map<number, boolean>>(new Map());

// 追踪正在播放的 liveId
const playingLiveIds = ref<Set<string>>(new Set());
const isUnmounted = ref(false);
const pageVersion = ref(0);
const loadInFlight = ref(false);
const queuedLoad = ref<{ page?: number; version?: number } | null>(null);

// 预取 Promise 缓存
const prefetchPromiseMap = ref<Map<number, Promise<void>>>(new Map());

// 判断游标是否有效
const isValidNextCursor = (next: string | undefined, dataLength: number): boolean => {
  if (!next) return false;
  if (next === '0' || next === '') return false;
  if (dataLength < pageSize) return false;
  return true;
};

// 预取下一页数据
const prefetchNextPage = (nextPage: number, cursor: string) => {
  if (prefetchPromiseMap.value.has(nextPage)) return;

  const promise = (async () => {
    try {
      const response = await getRoomList({ next: cursor, count: pageSize, sortDirection: 'descend' });
      const roomList = response.Response?.RoomList || [];
      if (roomList.length === 0 || isUnmounted.value) return;

      const liveList = roomList.map((item) => ({
        liveId: item.RoomId,
        roomId: item.RoomId,
        liveName: item.RoomName || '',
        anchorId: item.Owner_Account || '',
        coverUrl: item.CoverURL || '',
        viewCount: item.ViewCount || 0,
        popularity: item.Popularity || 0,
        activityStatus: item.ActivityStatus || 0,
        createTime: item.CreateTime || 0,
      }));

      if (!pageDataCache.value.has(nextPage)) {
        pageDataCache.value.set(nextPage, liveList);
      }

      const nextCursorFromResponse = response.Response?.Next || '';
      const hasMore = isValidNextCursor(nextCursorFromResponse, liveList.length);
      pageHasMore.value.set(nextPage, hasMore);

      if (hasMore && nextCursorFromResponse) {
        pageCursors.value.set(nextPage + 1, nextCursorFromResponse);
      }

      // 预取主播头像
      const ownerAccounts = roomList
        .map((item: any) => item.Owner_Account)
        .filter((id: string | undefined): id is string => Boolean(id));
      if (ownerAccounts.length > 0) {
        const uncachedIds = ownerAccounts.filter((id: string) => !userProfileMap.value.has(id));
        if (uncachedIds.length > 0) {
          try {
            const profileMap = await batchGetUserProfilePortrait(uncachedIds);
            if (!isUnmounted.value) {
              userProfileMap.value = new Map([...userProfileMap.value, ...profileMap]);
            }
          } catch {
            // 预取失败静默忽略
          }
        }
      }
    } catch {
      // 预取失败不影响主流程
    } finally {
      prefetchPromiseMap.value.delete(nextPage);
    }
  })();

  prefetchPromiseMap.value.set(nextPage, promise);
};

// 获取指定页的数据
const fetchPageData = async (pageToLoad: number) => {
  // 策略 1: 直接命中缓存
  const cachedData = pageDataCache.value.get(pageToLoad);
  if (cachedData) {
    const cachedHasMore = pageHasMore.value.get(pageToLoad) ?? false;
    return { liveList: cachedData, hasMore: cachedHasMore, fromNetwork: false };
  }

  // 策略 2: 有正在进行的预取，等待它完成
  const pendingPrefetch = prefetchPromiseMap.value.get(pageToLoad);
  if (pendingPrefetch) {
    await pendingPrefetch;
    const prefetchedData = pageDataCache.value.get(pageToLoad);
    if (prefetchedData) {
      const cachedHasMore = pageHasMore.value.get(pageToLoad) ?? false;
      return { liveList: prefetchedData, hasMore: cachedHasMore, fromNetwork: false };
    }
  }

  // 策略 3: 发起新请求
  const nextCursor = pageCursors.value.get(pageToLoad) || '';
  const response = await getRoomList({ next: nextCursor, count: pageSize, sortDirection: 'descend' });
  const roomList = response.Response?.RoomList || [];

  const liveList = roomList.map((item) => ({
    liveId: item.RoomId,
    roomId: item.RoomId,
    liveName: item.RoomName || '',
    anchorId: item.Owner_Account || '',
    coverUrl: item.CoverURL || '',
    viewCount: item.ViewCount || 0,
    popularity: item.Popularity || 0,
    activityStatus: item.ActivityStatus || 0,
    createTime: item.CreateTime || 0,
  }));

  pageDataCache.value.set(pageToLoad, liveList);

  const nextCursorFromResponse = response.Response?.Next || '';
  const hasMore = isValidNextCursor(nextCursorFromResponse, liveList.length);
  pageHasMore.value.set(pageToLoad, hasMore);

  if (hasMore && nextCursorFromResponse) {
    pageCursors.value.set(pageToLoad + 1, nextCursorFromResponse);
    if (!pageDataCache.value.has(pageToLoad + 1)) {
      prefetchNextPage(pageToLoad + 1, nextCursorFromResponse);
    }
  }

  return { liveList, hasMore, fromNetwork: true };
};

// 加载并播放指定页
const loadAndPlayNewPage = async (page?: number, version?: number) => {
  if (isUnmounted.value) return;

  if (loadInFlight.value) {
    queuedLoad.value = { page, version };
    return;
  }

  loadInFlight.value = true;
  const pageToLoad = page ?? currentPage.value;
  const currentVersion = version ?? pageVersion.value;
  loading.value = true;

  try {
    const { liveList, hasMore } = await fetchPageData(pageToLoad);

    if (isUnmounted.value || pageVersion.value !== currentVersion) {
      return;
    }

    currentPage.value = pageToLoad;
    hasMoreData.value = hasMore;

    // 异步获取主播用户资料
    const anchorIds = liveList
      .map((item: any) => item.anchorId)
      .filter((id: string | undefined): id is string => Boolean(id));
    if (anchorIds.length > 0) {
      const uncachedIds = anchorIds.filter((id: string) => !userProfileMap.value.has(id));
      if (uncachedIds.length > 0) {
        batchGetUserProfilePortrait(uncachedIds)
          .then(profileMap => {
            if (!isUnmounted.value && pageVersion.value === currentVersion) {
              userProfileMap.value = new Map([...userProfileMap.value, ...profileMap]);
            }
          })
          .catch(() => { /* 批量获取用户资料失败，静默忽略 */ });
      }
    }

    if (isUnmounted.value || pageVersion.value !== currentVersion) {
      return;
    }

    // 标记是否有数据
    hasRoomData.value = liveList.length > 0;

    loading.value = false;

    if (isUnmounted.value || pageVersion.value !== currentVersion) {
      return;
    }

    // 记录本页所有 liveId
    playingLiveIds.value.clear();
    liveList.forEach((item: any) => playingLiveIds.value.add(item.liveId));

    // 分批进房
    const BATCH_CONCURRENCY = 4;
    for (let i = 0; i < liveList.length; i += BATCH_CONCURRENCY) {
      if (isUnmounted.value || pageVersion.value !== currentVersion) {
        break;
      }

      const batch = liveList.slice(i, i + BATCH_CONCURRENCY);
      await Promise.all(
        batch.map((item: any) =>
          startPlay(item.liveId, `live_monitor_view_${item.roomId}`)
            .catch((error: any) => {
              if (
                error === 2025 ||
                error === 70005 ||
                error?.message?.includes('USER_SIG_ILLEGAL')
              ) {
                localStorage.removeItem('tuiLiveMonitor-userInfo');
                router.push('/login');
              }
            })
        )
      );
    }
  } catch (error: any) {
    console.error('加载直播列表失败:', error);
    if (!isUnmounted.value) {
      loading.value = false;
    }
  } finally {
    loadInFlight.value = false;

    if (!isUnmounted.value && queuedLoad.value) {
      const nextLoad = queuedLoad.value;
      queuedLoad.value = null;
      loadAndPlayNewPage(nextLoad.page, nextLoad.version);
    }
  }
};

// 停止所有正在播放的房间
const stopAllPlayingLives = async (version?: number) => {
  const cleanupVersion = version ?? ++pageVersion.value;

  const ids = Array.from(playingLiveIds.value);
  playingLiveIds.value.clear();

  if (ids.length > 0) {
    await Promise.all(
      ids.map((liveId) =>
        stopPlay(liveId).catch((error) => {
          console.error('停止直播预览失败:', liveId, error);
        })
      )
    );
  }

  return cleanupVersion;
};

// 翻页
const switchPage = async (page: number) => {
  if (loading.value) return;
  if (page < 1) return;
  if (page > currentPage.value) {
    if (!hasMoreData.value) return;
    if (!pageDataCache.value.has(page) && !pageCursors.value.has(page)) return;
  }

  const newVersion = ++pageVersion.value;

  stopAllPlayingLives(newVersion);
  await loadAndPlayNewPage(page, newVersion);
};

// 强制关播
const handleCloseLive = (liveId: string, liveName: string) => {
  closeConfirm.value = { visible: true, liveId, liveName, closing: false };
};

const handleConfirmClose = async () => {
  const { liveId } = closeConfirm.value;
  if (!liveId) return;
  closeConfirm.value.closing = true;
  try {
    await stopPlay(liveId);
    playingLiveIds.value.delete(liveId);
    await closeRoom(liveId);
    closeConfirm.value = { visible: false, liveId: '', liveName: '', closing: false };
    message.success('该直播间已被强制关播');

    // 如果当前页是最后一页且只剩最后一个直播间，关播后跳转到上一页
    const isLastPage = !hasMoreData.value;
    const currentPageData = pageDataCache.value.get(currentPage.value);
    const currentItemCount = currentPageData?.length ?? monitorLiveInfoList.value.length;
    if (isLastPage && currentItemCount <= 1 && currentPage.value > 1) {
      // 清除当前页缓存，跳转上一页
      pageDataCache.value.delete(currentPage.value);
      pageHasMore.value.delete(currentPage.value);
      const newVersion = ++pageVersion.value;
      stopAllPlayingLives(newVersion);
      await loadAndPlayNewPage(currentPage.value - 1, newVersion);
    } else {
      // 正常刷新当前页
      // 清除当前页及后续页缓存，确保数据最新
      for (const key of pageDataCache.value.keys()) {
        if (key >= currentPage.value) {
          pageDataCache.value.delete(key);
          pageHasMore.value.delete(key);
        }
      }
      const newVersion = ++pageVersion.value;
      stopAllPlayingLives(newVersion);
      await loadAndPlayNewPage(currentPage.value, newVersion);
    }
  } catch (error) {
    console.error('强制关播失败:', error);
    closeConfirm.value.closing = false;
  }
};

const handleCancelClose = () => {
  closeConfirm.value = { visible: false, liveId: '', liveName: '', closing: false };
};

// 查看详情
const handleClickDetails = (liveId: string) => {
  // 保存分页状态到 sessionStorage，以便返回时恢复
  try {
    sessionStorage.setItem('liveMonitor_currentPage', String(currentPage.value));
    sessionStorage.setItem('liveMonitor_pageCursors', JSON.stringify(Array.from(pageCursors.value.entries())));
    sessionStorage.setItem('liveMonitor_pageHasMore', JSON.stringify(Array.from(pageHasMore.value.entries())));
  } catch { /* sessionStorage 不可用时静默忽略 */ }
  router.push(`/room-control/${liveId}`);
};

// 静音切换
const toggleMuteAudio = async (liveId: string) => {
  const newMutedState = !isMuted.value;
  await muteLiveAudio(liveId, newMutedState);
  isMuted.value = newMutedState;
};

// 搜索房间
const handleSearch = async (keyword?: string) => {
  const input = String(keyword ?? searchInput.value).trim();
  if (!input) {
    return;
  }
  if (getByteLength(input) > ROOM_SEARCH_MAX_BYTES) {
    message.error('输入内容太长');
    return;
  }
  if (searchInput.value !== input) {
    searchInput.value = input;
  }

  const roomId = input;

  searching.value = true;
  const searchVersion = await stopAllPlayingLives();

  try {
    const response = await getRoomDetail(roomId);

    if (isUnmounted.value || pageVersion.value !== searchVersion) {
      return;
    }

    if (response.ErrorCode !== 0) {
      message.error(getErrorMessage(response.ErrorCode, response.ErrorInfo, `没有搜到「${input}」`));
      await loadAndPlayNewPage(1, searchVersion);
      return;
    }

    const roomInfo = response.Response?.RoomInfo;
    if (roomInfo) {
      isSearchMode.value = true;

      const liveId = roomInfo.RoomId;
      const anchorId = roomInfo.Owner_Account || '';

      // 获取主播用户资料
      if (anchorId) {
        try {
          const profileMap = await batchGetUserProfilePortrait([anchorId]);
          if (!isUnmounted.value && pageVersion.value === searchVersion) {
            userProfileMap.value = new Map([...userProfileMap.value, ...profileMap]);
          }
        } catch {
          // 获取主播资料失败，静默忽略
        }
      }

      playingLiveIds.value.add(liveId);

      try {
        await startPlay(liveId, `live_monitor_view_${liveId}`);
      } catch {
        // startPlay 失败不影响搜索流程
      }

      if (isUnmounted.value || pageVersion.value !== searchVersion) {
        await stopPlay(liveId);
        return;
      }

      message.success('搜索成功');
    } else {
      message.error(`没有搜到「${input}」`);
      await loadAndPlayNewPage(1, searchVersion);
    }
  } catch (error: any) {
    console.error('搜索直播间失败:', error);

    if (error === 2025 || error === 70005 || error?.message?.includes('USER_SIG_ILLEGAL')) {
      localStorage.removeItem('tuiLiveMonitor-userInfo');
      router.push('/login');
      return;
    }

    message.error(`没有搜到「${input}」`);
    await loadAndPlayNewPage(1, searchVersion);
  } finally {
    if (!isUnmounted.value) {
      searching.value = false;
    }
  }
};

// 清空搜索（清空输入并刷新恢复完整列表）
const handleClearSearch = async () => {
  console.log('[LiveMonitor] handleClearSearch called, isSearchMode:', isSearchMode.value);
  searchInput.value = '';
  isSearchMode.value = false;
  pageDataCache.value.clear();
  pageHasMore.value.clear();
  pageCursors.value = new Map([[1, '']]);
  const resetVersion = await stopAllPlayingLives();
  console.log('[LiveMonitor] after stopAllPlayingLives, resetVersion:', resetVersion);
  await loadAndPlayNewPage(1, resetVersion);
  console.log('[LiveMonitor] after loadAndPlayNewPage');
};

// 刷新当前页面数据
const refreshing = ref(false);
const handleRefresh = async () => {
  if (refreshing.value || loading.value) return;
  refreshing.value = true;
  try {
    // 清空搜索模式
    if (isSearchMode.value) {
      isSearchMode.value = false;
      searchInput.value = '';
    }
    // 清空所有缓存，强制重新获取
    pageDataCache.value.clear();
    pageHasMore.value.clear();
    prefetchPromiseMap.value.clear();
    pageCursors.value = new Map([[1, '']]);
    const resetVersion = await stopAllPlayingLives();
    await loadAndPlayNewPage(1, resetVersion);
    message.success('刷新成功');
  } catch (error: any) {
    console.error('刷新失败:', error);
    const errorInfo = error?.ErrorInfo || error?.errorInfo || '';
    message.error(`刷新失败${errorInfo ? ` (${errorInfo})` : ''}`);
  } finally {
    if (!isUnmounted.value) {
      refreshing.value = false;
    }
  }
};

// 退出全屏
const exitFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
};

// 获取主播头像
const getAnchorAvatar = (item: any): string => {
  const liveOwner = item.liveOwner;
  const liveOwnerStr = typeof liveOwner === 'string' ? liveOwner : undefined;
  const anchorId =
    liveOwnerStr ||
    item.liveOwner?.userId ||
    item.liveOwner?.userName ||
    item.anchorId ||
    item.roomOwner ||
    item.ownerId ||
    item.Owner_Account ||
    item.ownerAccount ||
    '';

  const userProfile = anchorId ? userProfileMap.value.get(anchorId) : undefined;

  const directAvatar =
    typeof item.avatarUrl === 'string'
      ? item.avatarUrl?.trim() || ''
      : '';

  return userProfile?.avatarUrl || directAvatar || resolveAnchorAvatarUrl(item);
};

// 获取主播名称
const getAnchorName = (item: any): string => {
  const liveOwner = item.liveOwner;
  const liveOwnerStr = typeof liveOwner === 'string' ? liveOwner : undefined;
  const anchorId =
    liveOwnerStr ||
    item.liveOwner?.userId ||
    item.liveOwner?.userName ||
    item.anchorId ||
    item.roomOwner ||
    item.ownerId ||
    item.Owner_Account ||
    item.ownerAccount ||
    '';

  const userProfile = anchorId ? userProfileMap.value.get(anchorId) : undefined;
  return userProfile?.nick || resolveAnchorDisplayName(item, '未知主播');
};

// 全屏事件监听
const onFullscreenChange = async () => {
  if (document.fullscreenElement) {
    isFullscreen.value = true;
  } else {
    isFullscreen.value = false;
    if (!isMuted.value && fullscreenLiveId.value) {
      await muteLiveAudio(fullscreenLiveId.value, true);
      isMuted.value = true;
      fullscreenLiveId.value = '';
    }
  }
};

// 初始化 SDK（monitor 特有的 init 调用）
const initSDK = async () => {
  const account = await createBasicAccount();

  if (account && account.sdkAppId !== 0) {
    try {
      init({
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api',
        account: {
          sdkAppId: account.sdkAppId,
          userId: account.userId,
          password: account.userSig,
        },
      });

      // SDK 登录已由 MainLayout 完成，这里直接加载数据
      // 如果 MainLayout 的 sdkReady 还没准备好，通过 watch 等待
      if (sdkReady?.value) {
        loadAndPlayNewPage(restoredPage);
      }
    } catch (err) {
      console.error('SDK init error:', err);
    }
  }
};

// 从 sessionStorage 恢复分页状态
const restorePaginationState = (): number => {
  try {
    const savedPage = sessionStorage.getItem('liveMonitor_currentPage');
    const savedCursors = sessionStorage.getItem('liveMonitor_pageCursors');
    const savedHasMore = sessionStorage.getItem('liveMonitor_pageHasMore');

    // 清除已读取的状态（一次性恢复）
    sessionStorage.removeItem('liveMonitor_currentPage');
    sessionStorage.removeItem('liveMonitor_pageCursors');
    sessionStorage.removeItem('liveMonitor_pageHasMore');

    if (savedPage && savedCursors) {
      const page = Number(savedPage);
      if (page > 0) {
        const cursors: [number, string][] = JSON.parse(savedCursors);
        pageCursors.value = new Map(cursors);
        if (savedHasMore) {
          const hasMoreEntries: [number, boolean][] = JSON.parse(savedHasMore);
          pageHasMore.value = new Map(hasMoreEntries);
        }
        return page;
      }
    }
  } catch { /* 解析失败时回退到第1页 */ }
  return 1;
};

// 监听 MainLayout 的 sdkReady，确保登录完成后才加载数据
const restoredPage = restorePaginationState();
watch(() => sdkReady?.value, (ready) => {
  if (ready) {
    loadAndPlayNewPage(restoredPage);
  }
});

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // 如果 initSDK 不主动触发加载（sdkReady 已为 true），则用 restoredPage 加载
  initSDK();
});

onUnmounted(() => {
  isUnmounted.value = true;
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  const cleanupVersion = ++pageVersion.value;
  stopAllPlayingLives(cleanupVersion);
});
</script>

<style scoped>
/* 页面标题 - 使用硬编码颜色 */
.monitor-title {
  font-size: 20px;
  font-weight: 600;
  color: #000;
  margin: 0;
}

.monitor-subtitle {
  font-size: 14px;
  color: #333;
  margin: 0;
}

</style>
