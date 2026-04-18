<template>
  <div class="login-container">
    <div class="login-content">
      <!-- 标题 -->
      <div class="login-header">
        <h1 class="login-title">LiveKit 管理后台</h1>
      </div>

      <!-- 加载状态 -->
      <div v-if="mode === 'loading'" class="login-loading">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>

      <!-- 登录表单 -->
      <div v-else class="login-form-wrapper">
        <!-- SdkAppId 字段 -->
        <div v-if="needSdkAppId" class="login-field login-field--horizontal">
          <label class="login-field__label">SdkAppId</label>
          <t-input
            v-model="formData.sdkAppId"
            placeholder="请输入 SdkAppId（数字）"
            class="login-input"
            :readonly="serverConfig.hasSdkAppId"
          />
        </div>

        <!-- UserId 字段 -->
        <div class="login-field login-field--horizontal">
          <label class="login-field__label">UserId</label>
          <t-input
            v-model="formData.userId"
            placeholder="留空则使用服务器配置的 Identifier"
            class="login-input"
          />
        </div>

        <!-- UserSig 字段 -->
        <div v-if="needUserSig" class="login-field login-field--horizontal">
          <label class="login-field__label">UserSig</label>
          <t-input
            v-model="formData.userSig"
            placeholder="请输入 UserSig"
            class="login-input"
            @keyup.enter="handleLogin"
          />
        </div>

        <!-- Domain 字段 -->
        <div class="login-field login-field--horizontal">
          <label class="login-field__label">Domain</label>
          <t-input
            v-model="formData.domain"
            placeholder="留空则使用后端配置的 Domain"
            class="login-input"
          />
        </div>

        <!-- 确认登录按钮 -->
        <t-button
          theme="primary"
          size="large"
          block
          :loading="loading"
          shape="round"
          @click="handleLogin"
        >
          确认登录
        </t-button>

        <!-- 凭证提示 -->
        <div v-if="credentialHint" class="credential-hint">
          {{ credentialHint }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { MessagePlugin } from 'tdesign-vue-next';
import { checkServerConfig, login, saveCredentials, isLoggedIn, clearCredentials } from '@/api';
import {
  getUrlOverrideParams,
  setServerConfigured,
} from '@live-manager/common';

const router = useRouter();

const loading = ref(false);
const mode = ref<'loading' | 'credential'>('loading');

interface ServerConfigState {
  hasSdkAppId: boolean;
  hasSecretKey: boolean;
  sdkAppId: number;
}

const serverConfig = ref<ServerConfigState>({
  hasSdkAppId: false,
  hasSecretKey: false,
  sdkAppId: 0,
});

const formData = reactive({
  userId: '',
  userSig: '',
  sdkAppId: '',
  domain: '',
});

// 计算需要用户输入的字段
const needSdkAppId = computed(() => !serverConfig.value.hasSdkAppId);
const needUserSig = computed(() => !serverConfig.value.hasSecretKey);

// 凭证提示信息
const credentialHint = computed(() => {
  const missing: string[] = [];
  if (!serverConfig.value.hasSecretKey) missing.push('SecretKey');
  if (!serverConfig.value.hasSdkAppId) missing.push('SdkAppId');
  if (missing.length === 0) return '';
  return `服务端未配置 ${missing.join('、')}，需手动输入对应凭证。`;
});

onMounted(async () => {
  // 检查 URL 参数
  const urlOverride = getUrlOverrideParams();

  // URL 中有参数 → 强制使用 URL 参数登录
  if (urlOverride) {
    clearCredentials(); // 清除旧凭证

    try {
      // URL override 模式：只传 sdkAppId，服务器会使用配置的 Identifier 作为 userId
      const loginRes = await login({
        sdkAppId: urlOverride.sdkAppId,
      });
      if (loginRes.code === 0 && loginRes.data) {
        setServerConfigured(false); // 标记为非服务器配置
        saveCredentials(loginRes.data);
        router.replace('/room-list');
        return;
      }
      MessagePlugin.error(loginRes.message || 'URL 参数自动登录失败');
    } catch (error: any) {
      MessagePlugin.error(error.message || 'URL 参数自动登录失败');
    }
    mode.value = 'credential';
    return;
  }

  // 如果已登录，直接跳转
  if (isLoggedIn()) {
    router.replace('/room-list');
    return;
  }

  // 检查服务器配置
  try {
    const res = await checkServerConfig();
    const data = res.data;

    if (!data) {
      mode.value = 'credential';
      return;
    }

    serverConfig.value = {
      hasSdkAppId: data.hasSdkAppId ?? false,
      hasSecretKey: data.hasSecretKey ?? false,
      sdkAppId: data.sdkAppId ?? 0,
    };

    // 两项全配置 → 自动登录
    if (serverConfig.value.hasSdkAppId &&
        serverConfig.value.hasSecretKey) {
      try {
        const loginRes = await login({});
        if (loginRes.code === 0 && loginRes.data) {
          setServerConfigured(true); // 标记为服务器配置
          saveCredentials(loginRes.data);
          router.replace('/room-list');
          return;
        } else {
          MessagePlugin.error(loginRes.message || '自动登录失败，请检查服务器配置');
        }
      } catch (error: any) {
        MessagePlugin.error(error.message || '自动登录失败，请检查网络连接');
      }
    }

    // 未完整配置或自动登录失败 → 显示凭证表单
    formData.sdkAppId = serverConfig.value.hasSdkAppId
      ? String(serverConfig.value.sdkAppId)
      : '';
    mode.value = 'credential';
  } catch (error) {
    mode.value = 'credential';
  }
});

const handleLogin = async () => {
  // 校验
  if (!serverConfig.value.hasSdkAppId && (!formData.sdkAppId.trim() || isNaN(Number(formData.sdkAppId)))) {
    MessagePlugin.error('请输入有效的 SdkAppId');
    return;
  }
  if (!formData.userSig.trim()) {
    MessagePlugin.error('请输入 UserSig');
    return;
  }

  loading.value = true;
  try {
    const response = await login({
      userId: formData.userId.trim() || undefined,
      userSig: formData.userSig.trim(),
      sdkAppId: Number(formData.sdkAppId.trim()),
      domain: formData.domain.trim() || undefined,
    });
    if (response.code === 0 && response.data) {
      saveCredentials(response.data);
      MessagePlugin.success('登录成功');
      router.push('/room-list');
    } else {
      MessagePlugin.error(response.message || '登录失败');
    }
  } catch (error: any) {
    MessagePlugin.error(error.message || '网络请求失败');
  } finally {
    loading.value = false;
  }
};
</script>