<!--
  * 名称：HostStudioView
  * 说明：主播端 · 竖屏宣讲（面向手机观众）：token 换票 → joinLive → StreamMixer 推流；
  *   不展示观众列表/连麦能力，弹幕收在底部；画面源默认折叠减少空白。
-->
<template>
  <div class="host-studio" :class="{ 'host-studio--live': isInLive }">
    <!-- 准备开播 -->
    <template v-if="!isInLive">
      <div class="host-shell host-shell--setup">
        <n-page-header title="开播" subtitle="宣讲模式 · 竖屏" @back="goBack">
          <template #extra>
            <n-tag size="small" type="info" round>主播</n-tag>
          </template>
        </n-page-header>

        <n-alert v-if="errorMsg" type="error" title="进房失败" class="host-gap">
          {{ errorMsg }}
        </n-alert>
        <n-alert v-else-if="!token" type="warning" title="缺少入口" class="host-gap">
          在
          <n-button text type="primary" tag="a" href="#/room-list">直播间管理</n-button>
          复制「主播链接」后打开本页。
        </n-alert>
        <n-alert v-else-if="state === 'consuming'" type="info" title="登录中" class="host-gap">
          校验入口并登录…
        </n-alert>

        <n-card v-if="hostInfo.roomId && state === 'ready'" size="small" class="host-card host-gap" :bordered="false">
          <div class="host-meta">
            <div><span class="host-meta-k">房间</span>{{ hostInfo.roomId }}</div>
            <div><span class="host-meta-k">主播</span>{{ hostInfo.userId }}</div>
          </div>
          <n-button
            type="primary"
            block
            round
            size="large"
            class="host-start-btn"
            :loading="starting"
            :disabled="!sdkReady || starting"
            @click="handleStartLive"
          >
            {{ starting ? '进入中…' : sdkReady ? '开始宣讲直播' : '引擎初始化…' }}
          </n-button>
        </n-card>
      </div>
    </template>

    <!-- 直播中：竖屏单列 -->
    <template v-else>
      <div class="host-shell host-shell--live">
        <header class="host-topbar">
          <n-button quaternary circle size="small" class="host-icon-btn" @click="handleLeaveClick" title="离开">
            <template #icon><ArrowLeft :size="20" /></template>
          </n-button>
          <div class="host-topbar__title">
            <span class="host-title-ellipsis">{{ currentLive?.liveName || hostInfo.roomId }}</span>
            <span class="host-live-dot">直播</span>
          </div>
          <n-button size="small" type="error" round :loading="ending" :disabled="ending" @click="handleEndLiveClick">
            结束
          </n-button>
        </header>

        <p class="host-subline">{{ audienceCount }} 人在线</p>

        <div class="host-stage-wrap">
          <div v-if="!sdkReady" class="host-stage-placeholder">准备画面…</div>
          <StreamMixer v-else class="host-stream-mixer" />
        </div>

        <n-collapse class="host-tools" :default-expanded-names="[]">
          <n-collapse-item title="摄像头 / 画面" name="scene">
            <LiveScenePanel class="host-scene-panel" />
          </n-collapse-item>
        </n-collapse>

        <section class="host-chat">
          <div class="host-chat__label">弹幕</div>
          <BarrageList class="host-barrage-list" />
          <BarrageInput class="host-barrage-input" height="48px" />
        </section>
      </div>
    </template>

    <n-modal
      v-model:show="endConfirmVisible"
      preset="dialog"
      title="结束直播"
      positive-text="结束"
      negative-text="取消"
      @positive-click="handleConfirmEndLive"
    >
      确定结束？手机端观众将看不到画面。
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
import { consumeHostEntryToken } from '@/api/host-entry';
import { pickUserOnSeat } from '@/api/room';
import { getErrorMessage } from '@live-manager/common';
import { message } from '@/utils/message';

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

const hostInfo = reactive<{ roomId: string; userId: string; sdkAppId: number; userSig: string }>({
  roomId: '',
  userId: '',
  sdkAppId: 0,
  userSig: '',
});

const { login: tuikitLogin } = useLoginState();
const { init } = useLiveMonitorState();
const { joinLive, leaveLive, endLive, currentLive, subscribeEvent, unsubscribeEvent } = useLiveListState();
const { audienceCount } = useLiveAudienceState();
const { openLocalMicrophone, openLocalCamera } = useDeviceState();
const roomEngine = useRoomEngine();

const isInLive = computed(() => !!currentLive.value?.liveId);

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
    message.success('已开始直播');
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

const handleEndLiveClick = () => {
  endConfirmVisible.value = true;
};

const handleConfirmEndLive = async (): Promise<boolean> => {
  ending.value = true;
  try {
    await endLive();
    message.success('已结束');
    try {
      await leaveLive();
    } catch (e) {
      console.warn('[host] leaveLive after end', e);
    }
    goBack();
    return true;
  } catch (err: unknown) {
    const e = err as { errorCode?: number; code?: number; errorInfo?: string; message?: string };
    const code = e?.errorCode ?? e?.code ?? 0;
    const info = e?.errorInfo || e?.message || '';
    message.error(getErrorMessage(code, info) || '结束失败');
    return false;
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
/* 竖屏宣讲：单列窄壳，减少左右留白 */
$host-max: 420px;

.host-studio {
  min-height: 100dvh;
  min-height: 100vh;
  box-sizing: border-box;
  background: #eef1f6;

  &--live {
    background: #07090d;
    color: #e8eaed;
  }
}

.host-shell {
  max-width: $host-max;
  margin: 0 auto;
  padding: 12px 12px 24px;
  box-sizing: border-box;

  &--live {
    height: 100dvh;
    height: 100vh;
    padding: 8px 10px 12px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
}

.host-gap {
  margin-top: 12px;
}

.host-card {
  border-radius: 12px;
}

.host-meta {
  font-size: 13px;
  line-height: 1.7;
  color: #4e5969;
  margin-bottom: 16px;

  .host-meta-k {
    display: inline-block;
    width: 40px;
    color: #86909c;
  }
}

.host-start-btn {
  font-weight: 600;
}

/* —— 直播中 —— */
.host-topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 0;
}

.host-icon-btn {
  color: rgba(255, 255, 255, 0.85) !important;
}

.host-topbar__title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.host-title-ellipsis {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host-live-dot {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(7, 193, 96, 0.2);
  color: #34d399;
}

.host-subline {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
}

/* 9:16 竖屏画面：高度不超过约 68% 视口，宽度随比例收窄并居中 */
.host-stage-wrap {
  position: relative;
  width: min(100%, calc(68dvh * 9 / 16));
  aspect-ratio: 9 / 16;
  max-height: 68dvh;
  margin: 0 auto;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: #12151c;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.host-stage-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.host-stream-mixer {
  width: 100%;
  height: 100%;
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

.host-tools {
  flex-shrink: 0;
  margin-top: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);

  :deep(.n-collapse-item__header) {
    color: rgba(255, 255, 255, 0.88);
    padding: 6px 10px;
    font-size: 13px;
  }

  :deep(.n-collapse-item__content-inner) {
    padding: 6px 8px 10px;
    max-height: 38dvh;
    overflow: auto;
  }
}

.host-scene-panel {
  padding: 0;
}

/* 底部弹幕：吃掉剩余高度，避免大块空白 */
.host-chat {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.host-chat__label {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.host-barrage-list {
  flex: 1;
  min-height: 88px;
  overflow: hidden;
}

.host-barrage-input {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 6px 8px;
  box-sizing: border-box;
}
</style>
