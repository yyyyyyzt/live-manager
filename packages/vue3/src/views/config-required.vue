<template>
  <div class="login-container">
    <div class="login-content">
      <!-- 标题 -->
      <div class="login-header">
        <h1 class="login-title">LiveKit 管理后台</h1>
      </div>

      <!-- 警告提示 -->
      <div class="config-warning">
        <div class="config-warning__title">配置缺失提示</div>
        <div class="config-warning__content">
          服务器缺少以下配置项：
          <span v-for="(item, index) in missingItems" :key="item" class="config-warning__item">
            {{ getMissingLabel(item) }}{{ index < missingItems.length - 1 ? '、' : '' }}
          </span>
          <br /><br />
          请在 server 的 <code>config/.env</code> 文件中或者在运行环境的环境变量中配置以下环境变量：
          <ul class="config-warning__list">
            <li><code>SDK_APP_ID</code> - 腾讯云 SDK AppID</li>
            <li><code>SECRET_KEY</code> - 腾讯云 SecretKey</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { checkServerConfig, isLoggedIn } from '@/api';
// 导入公共样式
import '@live-manager/common/style/config-warning.css';

const router = useRouter();
const route = useRoute();

const missingItems = ref<string[]>([]);

onMounted(async () => {
  // 从路由 query 获取缺失项
  const queryMissing = route.query.missing;
  if (queryMissing && typeof queryMissing === 'string') {
    missingItems.value = queryMissing.split(',');
  } else {
    // 重新检查配置状态
    try {
      const res = await checkServerConfig();
      const data = res.data;
      if (!data) {
        missingItems.value = ['SDK_APP_ID', 'SECRET_KEY', 'USER_ID'];
        return;
      }

      const missing: string[] = [];
      if (!data.hasSdkAppId) missing.push('SDK_APP_ID');
      if (!data.hasSecretKey) missing.push('SECRET_KEY');
      if (!data.hasIdentifier) missing.push('USER_ID');
      missingItems.value = missing;

      // 如果已登录且无缺失项，直接跳转
      if (missing.length === 0 && isLoggedIn()) {
        router.replace('/room-list');
      }
    } catch {
      missingItems.value = ['SDK_APP_ID', 'SECRET_KEY', 'USER_ID'];
    }
  }
});

const getMissingLabel = (item: string) => {
  const labels: Record<string, string> = {
    'SDK_APP_ID': 'SdkAppId',
    'SECRET_KEY': 'SecretKey',
    'USER_ID': 'UserId',
  };
  return labels[item] || item;
};
</script>
