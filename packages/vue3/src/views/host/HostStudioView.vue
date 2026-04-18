<!--
  * 名称：HostStudioView
  * 说明：极简主播端入口页；后续在此接入 TUILiveKit 推流（与管理员同仓单 Vite）。
-->
<template>
  <div id="hostStudioRoot" class="host-studio">
    <n-page-header title="主播端" subtitle="单 Vite 路由 · Demo" @back="goBack">
      <template #extra>
        <n-tag type="info">/host</n-tag>
      </template>
    </n-page-header>
    <n-alert type="warning" title="开发提示" class="host-alert">
      管理员建场后，将在此使用入口 token 完成登录并进房推流。当前为占位页，可与
      <n-button text type="primary" tag="a" href="#/room-list">直播间管理</n-button>
      联调流程。
    </n-alert>
    <n-card title="环境" size="small" class="host-card">
      <n-descriptions :column="1" bordered size="small">
        <n-descriptions-item label="API">
          {{ apiBase }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api';

const goBack = () => {
  router.push('/room-list');
};
</script>

<style scoped lang="scss">
.host-studio {
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
}

.host-alert {
  margin-top: 16px;
}

.host-card {
  margin-top: 16px;
}
</style>
