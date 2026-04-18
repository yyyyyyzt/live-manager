<!--
  * 名称：HostStudioView
  * 说明：
  *   主播端入口页。若 URL 带 `token=...`，向 `/api/host_entry/consume` 换取短期
  *   凭证（sdkAppId + userId + userSig），随后完成 TUILogin。后续正式推流由产品
  *   接入方自行挂载 TUILiveKit 组件（见文末卡片说明）。
-->
<template>
  <div id="hostStudioRoot" class="host-studio">
    <n-page-header title="主播端" subtitle="单 Vite 路由 · Demo" @back="goBack">
      <template #extra>
        <n-tag type="info">/host</n-tag>
      </template>
    </n-page-header>

    <n-alert v-if="errorMsg" type="error" title="进房失败" class="host-alert">
      {{ errorMsg }}
    </n-alert>
    <n-alert v-else-if="!token" type="warning" title="开发提示" class="host-alert">
      请在
      <n-button text type="primary" tag="a" href="#/room-list">直播间管理</n-button>
      点击「主播链接」复制含 token 的链接后打开本页。
    </n-alert>
    <n-alert v-else-if="state === 'consuming'" type="info" title="正在登录" class="host-alert">
      正在通过主播入口 token 换取短期凭证...
    </n-alert>
    <n-alert v-else-if="state === 'ready'" type="success" title="主播已登录" class="host-alert">
      凭证交换与 TUILogin 完成；可在下方卡片挂载 TUILiveKit 推流组件。
    </n-alert>

    <n-card v-if="hostInfo.roomId" title="当前主播" size="small" class="host-card">
      <n-descriptions :column="1" bordered size="small">
        <n-descriptions-item label="房间 ID">{{ hostInfo.roomId }}</n-descriptions-item>
        <n-descriptions-item label="主播 UserID">{{ hostInfo.userId }}</n-descriptions-item>
        <n-descriptions-item label="SdkAppID">{{ hostInfo.sdkAppId }}</n-descriptions-item>
        <n-descriptions-item label="UserSig 前缀">{{ userSigPreview }}</n-descriptions-item>
        <n-descriptions-item label="API Base">{{ apiBase }}</n-descriptions-item>
      </n-descriptions>
    </n-card>

    <n-card v-if="state === 'ready'" title="推流接入占位" size="small" class="host-card">
      <n-p depth="3" class="host-hint">
        本 Demo 仅完成「建场 → 复制链接 → 主播登录」的链路；
        实际直播推流（采集、分辨率、连麦、分发）建议在此处挂载
        <n-text code>TUILiveKit</n-text>（或对应 preset 组件）。关键凭证已注入：
      </n-p>
      <n-code language="javascript" class="host-snippet" :code="snippetCode" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLoginState, useLiveMonitorState } from 'tuikit-atomicx-vue3/live';
import { consumeHostEntryToken } from '@/api/host-entry';

const route = useRoute();
const router = useRouter();

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api';

const token = ref<string>(String(route.query.token || ''));
const state = ref<'idle' | 'consuming' | 'ready' | 'error'>(token.value ? 'consuming' : 'idle');
const errorMsg = ref('');

const hostInfo = reactive<{ roomId: string; userId: string; sdkAppId: number; userSig: string }>({
  roomId: '',
  userId: '',
  sdkAppId: 0,
  userSig: '',
});

const userSigPreview = computed(() =>
  hostInfo.userSig ? `${hostInfo.userSig.slice(0, 12)}…（已隐藏）` : '-'
);

const snippetCode = computed(() => `// 主播端凭证已就绪
const account = {
  sdkAppId: ${hostInfo.sdkAppId},
  userId: '${hostInfo.userId}',
  userSig: '<已注入>',
};
// 下一步：按产品接入 TUILiveKit 推流组件
// 例如: <TUILiveRoom :params="account" :roomId="'${hostInfo.roomId}'" />`);

const goBack = () => {
  router.push('/room-list');
};

const { login: tuikitLogin } = useLoginState();
const { init } = useLiveMonitorState();

const resetHostInfo = () => {
  hostInfo.roomId = '';
  hostInfo.userId = '';
  hostInfo.userSig = '';
  hostInfo.sdkAppId = 0;
};

const bootstrap = async (rawToken: string) => {
  errorMsg.value = '';
  resetHostInfo();
  if (!rawToken) {
    state.value = 'idle';
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
    } catch (err: any) {
      if (err?.code === 2025 || err?.message?.includes('重复登录')) {
        console.log('[host] 已登录，继续');
      } else {
        throw err;
      }
    }
    state.value = 'ready';
  } catch (e: any) {
    console.error('[host] bootstrap error:', e);
    errorMsg.value = e?.message || '登录失败';
    state.value = 'error';
  }
};

watch(
  () => String(route.query.token || ''),
  (next) => {
    token.value = next;
    bootstrap(next);
  }
);

onMounted(() => {
  bootstrap(token.value);
});
</script>

<style scoped lang="scss">
.host-studio {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}

.host-alert {
  margin-top: 16px;
}

.host-card {
  margin-top: 16px;
}

.host-hint {
  margin: 0 0 12px;
}

.host-snippet {
  white-space: pre;
  font-size: 12px;
}
</style>
