<!--
  主播端：入口 token 换票 → joinLive → StreamMixer；
  默认竖屏 9:16，可切换横屏 / 宽屏布局；结束直播走 host_entry/destroy_room（房主解散）避免 SDK endLive 100006。
-->
<template>
  <div class="host-studio" :class="rootClasses">
    <!-- 准备开播 -->
    <template v-if="!isInLive">
      <div class="host-setup">
        <div class="host-setup-card">
          <header class="host-setup-head">
            <n-button quaternary circle size="small" class="host-setup-back" @click="goBack" title="返回">
              <template #icon><ArrowLeft :size="20" /></template>
            </n-button>
            <div class="host-setup-head-text">
              <h1 class="host-setup-title">开播</h1>
              <p class="host-setup-sub">竖屏优先 · 宣讲模式</p>
            </div>
            <n-tag size="small" type="success" round bordered>主播</n-tag>
          </header>

          <n-alert v-if="errorMsg" type="error" class="host-setup-alert" :bordered="false">
            {{ errorMsg }}
          </n-alert>
          <n-alert v-else-if="!token" type="warning" class="host-setup-alert" :bordered="false">
            请从
            <n-button text type="primary" tag="a" href="#/room-list">直播间管理</n-button>
            复制「主播链接」后在本页打开。
          </n-alert>
          <n-alert v-else-if="state === 'consuming'" type="info" class="host-setup-alert" :bordered="false">
            正在校验入口…
          </n-alert>

          <div v-if="hostInfo.roomId && state === 'ready'" class="host-setup-body">
            <dl class="host-setup-dl">
              <div class="host-setup-row">
                <dt>房间</dt>
                <dd>{{ hostInfo.roomId }}</dd>
              </div>
              <div class="host-setup-row">
                <dt>账号</dt>
                <dd>{{ hostInfo.userId }}</dd>
              </div>
            </dl>
            <n-button
              type="primary"
              block
              round
              size="large"
              class="host-setup-go"
              :loading="starting"
              :disabled="!sdkReady || starting"
              @click="handleStartLive"
            >
              {{ starting ? '进入中…' : sdkReady ? '开始直播' : '引擎初始化中…' }}
            </n-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 直播中 -->
    <template v-else>
      <div class="host-live" :class="`host-live--${layoutMode}`">
        <header class="host-live-bar">
          <n-button quaternary circle size="small" class="host-live-bar-btn" @click="handleLeaveClick" title="退出（不关播）">
            <template #icon><ArrowLeft :size="20" /></template>
          </n-button>
          <div class="host-live-bar-center">
            <span class="host-live-name">{{ currentLive?.liveName || hostInfo.roomId }}</span>
            <span class="host-live-badge">LIVE</span>
          </div>
          <n-button size="small" type="error" round strong :loading="ending" :disabled="ending" @click="handleEndLiveClick">
            结束直播
          </n-button>
        </header>

        <div class="host-live-toolbar">
          <span class="host-live-online">{{ audienceCount }} 人在线</span>
          <n-button-group size="tiny" class="host-layout-group">
            <n-button :type="layoutMode === 'portrait' ? 'primary' : 'default'" ghost @click="layoutMode = 'portrait'">
              竖屏
            </n-button>
            <n-button :type="layoutMode === 'landscape' ? 'primary' : 'default'" ghost @click="layoutMode = 'landscape'">
              横屏
            </n-button>
            <n-button :type="layoutMode === 'wide' ? 'primary' : 'default'" ghost @click="layoutMode = 'wide'">
              宽屏
            </n-button>
          </n-button-group>
        </div>

        <div class="host-live-main">
          <div class="host-live-stage-col">
            <div class="host-live-stage" :class="`host-live-stage--${layoutMode}`">
              <div v-if="!sdkReady" class="host-live-stage-inner host-live-stage-ph">准备画面…</div>
              <StreamMixer v-else class="host-stream-mixer host-live-stage-inner" />
            </div>
            <n-collapse class="host-live-tools" :default-expanded-names="[]">
              <n-collapse-item title="摄像头 / 画面" name="scene">
                <LiveScenePanel class="host-scene-panel" />
              </n-collapse-item>
            </n-collapse>
          </div>

          <section class="host-live-chat">
            <div class="host-live-chat-hd">弹幕</div>
            <BarrageList class="host-barrage-list" />
            <BarrageInput class="host-barrage-input" height="48px" />
          </section>
        </div>
      </div>
    </template>

    <n-modal
      v-model:show="endConfirmVisible"
      preset="dialog"
      title="结束直播"
      positive-text="结束并解散房间"
      negative-text="取消"
      @positive-click="handleConfirmEndLive"
    >
      结束后观众将无法继续观看，房间将被解散。确定吗？
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import {
  StreamMixer,
  BarrageList,
  BarrageInput,
  LiveScenePanel,
  useLoginState,
  useLiveMonitorState,
  useLiveListState,
  useLiveAudienceState,
  useDeviceState,
  useRoomEngine,
  LiveListEvent,
} from 'tuikit-atomicx-vue3/live';
import { consumeHostEntryToken, destroyHostRoomByEntryToken } from '@/api/host-entry';
import { pickUserOnSeat } from '@/api/room';
import { getErrorMessage } from '@live-manager/common';
import { message } from '@/utils/message';

const HOST_ENTRY_TOKEN_KEY = 'host_entry_token_last';

const route = useRoute();
const router = useRouter();
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api';

const token = ref<string>(String(route.query.token || ''));
const state = ref<'idle' | 'consuming' | 'ready' | 'error'>(token.value ? 'consuming' : 'idle');
const errorMsg = ref('');
const sdkReady = ref(false);
const starting = ref(false);
const ending = ref(false);
const endConfirmVisible = ref(false);
/** 竖屏 9:16 | 横屏 16:9 偏竖壳 | 宽屏 画面与弹幕分栏 */
const layoutMode = ref<'portrait' | 'landscape' | 'wide'>('portrait');

const hostInfo = reactive<{ roomId: string; userId: string; sdkAppId: number; userSig: string }>({
  roomId: '',
  userId: '',
  sdkAppId: 0,
  userSig: '',
});

const { login: tuikitLogin } = useLoginState();
const { init } = useLiveMonitorState();
const { joinLive, leaveLive, currentLive, subscribeEvent, unsubscribeEvent } = useLiveListState();
const { audienceCount } = useLiveAudienceState();
const { openLocalMicrophone, openLocalCamera } = useDeviceState();
const roomEngine = useRoomEngine();

const isInLive = computed(() => !!currentLive.value?.liveId);

const rootClasses = computed(() => ({
  'host-studio--live': isInLive.value,
  [`host-studio--layout-${layoutMode.value}`]: isInLive.value,
}));

const goBack = () => {
  router.push('/room-list');
};

const resetHostInfo = () => {
  hostInfo.roomId = '';
  hostInfo.userId = '';
  hostInfo.userSig = '';
  hostInfo.sdkAppId = 0;
};

let sdkPollTimer: ReturnType<typeof setInterval> | null = null;

const stopSdkPoll = () => {
  if (sdkPollTimer) {
    clearInterval(sdkPollTimer);
    sdkPollTimer = null;
  }
};

const startSdkPoll = () => {
  stopSdkPoll();
  sdkPollTimer = setInterval(() => {
    if (roomEngine.instance) {
      sdkReady.value = true;
      stopSdkPoll();
    }
  }, 300);
};

const bootstrap = async (rawToken: string) => {
  errorMsg.value = '';
  resetHostInfo();
  sdkReady.value = false;
  if (!rawToken) {
    state.value = 'idle';
    stopSdkPoll();
    return;
  }
  state.value = 'consuming';
  try {
    const res = await consumeHostEntryToken(rawToken);
    if (res.code !== 0 || !res.data) {
      errorMsg.value = res.message || '换取凭证失败';
      state.value = 'error';
      return;
    }
    const { sdkAppId, userId, userSig, roomId } = res.data;
    hostInfo.sdkAppId = sdkAppId;
    hostInfo.userId = userId;
    hostInfo.userSig = userSig;
    hostInfo.roomId = roomId;
    try {
      sessionStorage.setItem(HOST_ENTRY_TOKEN_KEY, rawToken);
    } catch {
      /* ignore */
    }

    init({
      baseUrl: apiBase,
      account: { sdkAppId, userId, password: userSig },
    });
    try {
      await tuikitLogin({ sdkAppId, userId, userSig });
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e?.code === 2025 || e?.message?.includes('重复登录')) {
        console.log('[host] 已登录，继续');
      } else {
        throw err;
      }
    }
    state.value = 'ready';
    if (roomEngine.instance) {
      sdkReady.value = true;
    } else {
      startSdkPoll();
    }
  } catch (e: unknown) {
    console.error('[host] bootstrap error:', e);
    errorMsg.value = e instanceof Error ? e.message : '登录失败';
    state.value = 'error';
    stopSdkPoll();
  }
};

const tryPickSeatForHost = async () => {
  try {
    const res = await pickUserOnSeat(hostInfo.roomId, hostInfo.userId, 0);
    if (res.ErrorCode && res.ErrorCode !== 0) {
      console.warn('[host] pickUserOnSeat:', res.ErrorCode, res.ErrorInfo);
    }
  } catch (e) {
    console.warn('[host] pickUserOnSeat request failed:', e);
  }
};

const handleStartLive = async () => {
  if (!hostInfo.roomId || !sdkReady.value || starting.value) return;
  starting.value = true;
  try {
    await joinLive({ liveId: hostInfo.roomId });
    await nextTick();
    await nextTick();
    await tryPickSeatForHost();
    try {
      await openLocalCamera();
    } catch (camErr: unknown) {
      console.warn('[host] openLocalCamera first try:', camErr);
      await tryPickSeatForHost();
      try {
        await openLocalCamera();
      } catch (camErr2: unknown) {
        console.warn('[host] openLocalCamera second try:', camErr2);
        message.warning('摄像头未自动开启，请展开「摄像头 / 画面」手动添加');
      }
    }
    try {
      await openLocalMicrophone();
    } catch (micErr) {
      console.warn('[host] openLocalMicrophone:', micErr);
      message.warning('麦克风未自动开启，可在系统设置中授权后重试');
    }
    message.success('直播已开始');
  } catch (err: unknown) {
    const e = err as { errorCode?: number; code?: number; errorInfo?: string; message?: string };
    const code = e?.errorCode ?? e?.code ?? 0;
    const info = e?.errorInfo || e?.message || '';
    message.error(`进入失败：${getErrorMessage(code, info)}`);
    console.error('[host] joinLive', err);
  } finally {
    starting.value = false;
  }
};

const handleLeaveClick = async () => {
  if (ending.value) return;
  try {
    await leaveLive();
  } catch (e) {
    console.warn('[host] leaveLive', e);
  }
  goBack();
};

const getDestroyToken = (): string => {
  const q = String(route.query.token || '');
  if (q) return q;
  try {
    return sessionStorage.getItem(HOST_ENTRY_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const handleEndLiveClick = () => {
  endConfirmVisible.value = true;
};

const handleConfirmEndLive = async (): Promise<boolean> => {
  ending.value = true;
  const entryToken = getDestroyToken();
  try {
    if (!entryToken || !hostInfo.roomId) {
      message.error('缺少入口票据，无法解散房间。请使用「主播链接」重新进入后再结束。');
      try {
        await leaveLive();
      } catch {
        /* ignore */
      }
      goBack();
      return true;
    }
    const dr = await destroyHostRoomByEntryToken({ token: entryToken, roomId: hostInfo.roomId });
    const trtc = dr.data as { ErrorCode?: number; ErrorInfo?: string } | undefined;
    const trtcCode = trtc?.ErrorCode;
    if (dr.code === 0) {
      message.success('已结束直播');
    } else if (trtcCode === 100004) {
      message.info('房间已不存在，已为你退出');
    } else {
      message.warning(dr.message || '解散房间未成功，仍将退出本地连接');
    }
    try {
      await leaveLive();
    } catch (e) {
      console.warn('[host] leaveLive after destroy', e);
    }
    goBack();
    return true;
  } catch (err: unknown) {
    const e = err as { errorCode?: number; code?: number; errorInfo?: string; message?: string };
    const code = e?.errorCode ?? e?.code ?? 0;
    const info = e?.errorInfo || e?.message || '';
    message.error(getErrorMessage(code, info) || '结束失败');
    try {
      await leaveLive();
    } catch {
      /* ignore */
    }
    goBack();
    return true;
  } finally {
    ending.value = false;
  }
};

const onLiveEnded = () => {
  message.info('直播已结束');
  leaveLive().catch(() => {});
  goBack();
};

watch(
  () => String(route.query.token || ''),
  (next) => {
    token.value = next;
    bootstrap(next);
  }
);

onMounted(() => {
  subscribeEvent(LiveListEvent.onLiveEnded, onLiveEnded);
  bootstrap(token.value);
});

onUnmounted(() => {
  stopSdkPoll();
  unsubscribeEvent(LiveListEvent.onLiveEnded, onLiveEnded);
  leaveLive().catch(() => {});
});
</script>

<style scoped lang="scss">
.host-studio {
  min-height: 100dvh;
  min-height: 100vh;
  box-sizing: border-box;
  background: linear-gradient(160deg, #f0f4fa 0%, #e4eaf4 100%);
  color: #1d2129;

  &--live {
    background: #0b0d12;
    color: #e8eaed;
  }
}

/* —— 准备页 —— */
.host-setup {
  min-height: 100dvh;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 16px 32px;
  box-sizing: border-box;
}

.host-setup-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
  padding: 20px 20px 24px;
  box-sizing: border-box;
}

.host-setup-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}

.host-setup-back {
  margin-top: 2px;
  color: #4e5969 !important;
}

.host-setup-head-text {
  flex: 1;
  min-width: 0;
}

.host-setup-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #1d2129;
}

.host-setup-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #86909c;
}

.host-setup-alert {
  margin-bottom: 12px;
  border-radius: 10px;
}

.host-setup-body {
  margin-top: 8px;
}

.host-setup-dl {
  margin: 0 0 20px;
  padding: 12px 14px;
  background: #f7f8fa;
  border-radius: 12px;
  font-size: 13px;
}

.host-setup-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #eceff6;
  &:last-child {
    border-bottom: none;
  }
  dt {
    width: 40px;
    flex-shrink: 0;
    color: #86909c;
    font-weight: 500;
  }
  dd {
    margin: 0;
    flex: 1;
    min-width: 0;
    word-break: break-all;
    color: #1d2129;
  }
}

.host-setup-go {
  font-weight: 600;
  height: 48px;
}

/* —— 直播中壳 —— */
.host-live {
  min-height: 100dvh;
  min-height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 12px 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.host-live-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 8px;
}

.host-live-bar-btn {
  color: rgba(255, 255, 255, 0.88) !important;
}

.host-live-bar-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.host-live-name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host-live-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 4px;
  background: #e54545;
  color: #fff;
}

.host-live-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  padding-bottom: 10px;
}

.host-live-online {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.host-layout-group {
  flex-shrink: 0;
  :deep(.n-button) {
    padding: 0 10px;
    font-size: 12px;
  }
}

.host-live-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.host-live-stage-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  flex-shrink: 0;
}

.host-live-stage {
  position: relative;
  margin: 0 auto;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #12151c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.host-live-stage-inner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.host-live-stage-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

/* 竖屏 9:16（默认） */
.host-live-stage--portrait {
  width: min(100%, calc(72dvh * 9 / 16));
  aspect-ratio: 9 / 16;
  max-height: 72dvh;
}

/* 横屏 16:9 */
.host-live-stage--landscape {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 16 / 9;
  max-height: min(48dvh, 380px);
}

/* 宽屏布局内由外层 media 再约束 */
.host-live-stage--wide {
  width: min(100%, calc(60dvh * 9 / 16));
  aspect-ratio: 9 / 16;
  max-height: 60dvh;
}

.host-stream-mixer {
  display: block;

  :deep(.local-mixer-container) {
    width: 100%;
    height: 100%;
    position: relative;
  }
  :deep(.local-mixer-content) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  :deep(.mixer-control) {
    z-index: 2;
  }
}

.host-live-tools {
  flex-shrink: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  :deep(.n-collapse-item__header) {
    color: rgba(255, 255, 255, 0.9);
    padding: 8px 12px;
    font-size: 13px;
  }
  :deep(.n-collapse-item__content-inner) {
    padding: 8px 10px 12px;
    max-height: min(36dvh, 280px);
    overflow: auto;
  }
}

.host-scene-panel {
  padding: 0;
}

.host-live-chat {
  flex: 1;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.host-live-chat-hd {
  flex-shrink: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.host-barrage-list {
  flex: 1;
  min-height: 72px;
  overflow: hidden;
}

.host-barrage-input {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px 10px;
  box-sizing: border-box;
}

/* 横屏：主列纵向 */
.host-studio--layout-landscape .host-live-main {
  flex-direction: column;
}

.host-studio--layout-landscape .host-live-chat {
  flex: 1;
  min-height: 140px;
}

/* 宽屏：大屏 — 左画面右弹幕 */
@media (min-width: 720px) {
  .host-studio--layout-wide .host-live {
    max-width: 1100px;
    padding: 12px 16px 20px;
  }
  .host-studio--layout-wide .host-live-main {
    flex-direction: row;
    align-items: stretch;
    gap: 14px;
  }
  .host-studio--layout-wide .host-live-stage-col {
    flex: 1;
    min-width: 0;
  }
  .host-studio--layout-wide .host-live-stage--wide {
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: none;
    min-height: 220px;
  }
  .host-studio--layout-wide .host-live-tools {
    max-height: 240px;
  }
  .host-studio--layout-wide .host-live-chat {
    width: 300px;
    flex: 0 0 300px;
    min-height: 0;
  }
}

@media (max-width: 719px) {
  .host-studio--layout-wide .host-live-main {
    flex-direction: column;
  }
}
</style>
