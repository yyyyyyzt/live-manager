<!--
  * 名称：LoginView
  * 说明：凭证登录页；Naive UI。
-->
<template>
  <div class="login-container">
    <div class="login-content">
      <div class="login-header">
        <h1 class="login-title">LiveKit 管理后台</h1>
      </div>

      <div v-if="mode === 'loading'" class="login-loading">
        <n-spin size="large" />
      </div>

      <div v-else class="login-form-wrapper">
        <div v-if="needSdkAppId" class="login-field login-field--horizontal">
          <label class="login-field__label">SdkAppId</label>
          <n-input
            v-model:value="formData.sdkAppId"
            placeholder="请输入 SdkAppId（数字）"
            class="login-input"
            :disabled="serverConfig.hasSdkAppId"
          />
        </div>

        <div class="login-field login-field--horizontal">
          <label class="login-field__label">UserId</label>
          <n-input
            v-model:value="formData.userId"
            placeholder="留空则使用服务器配置的 Identifier"
            class="login-input"
          />
        </div>

        <div v-if="needUserSig" class="login-field login-field--horizontal">
          <label class="login-field__label">UserSig</label>
          <n-input
            v-model:value="formData.userSig"
            placeholder="请输入 UserSig"
            class="login-input"
            @keyup.enter="handleLogin"
          />
        </div>

        <div class="login-field login-field--horizontal">
          <label class="login-field__label">Domain</label>
          <n-input
            v-model:value="formData.domain"
            placeholder="留空则使用后端配置的 Domain"
            class="login-input"
          />
        </div>

        <n-button type="primary" size="large" block round :loading="loading" class="login-btn" @click="handleLogin">
          确认登录
        </n-button>

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
import { useMessage } from 'naive-ui';
import { checkServerConfig, login, saveCredentials, isLoggedIn, clearCredentials } from '@/api';
import {
  getUrlOverrideParams,
  setServerConfigured,
} from '@live-manager/common';

const router = useRouter();
const message = useMessage();

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

const needSdkAppId = computed(() => !serverConfig.value.hasSdkAppId);
const needUserSig = computed(() => !serverConfig.value.hasSecretKey);

const credentialHint = computed(() => {
  const missing: string[] = [];
  if (!serverConfig.value.hasSecretKey) missing.push('SecretKey');
  if (!serverConfig.value.hasSdkAppId) missing.push('SdkAppId');
  if (missing.length === 0) return '';
  return `服务端未配置 ${missing.join('、')}，需手动输入对应凭证。`;
});

onMounted(async () => {
  const urlOverride = getUrlOverrideParams();

  if (urlOverride) {
    clearCredentials();

    try {
      const loginRes = await login({
        sdkAppId: urlOverride.sdkAppId,
      });
      if (loginRes.code === 0 && loginRes.data) {
        setServerConfigured(false);
        saveCredentials(loginRes.data);
        router.replace('/room-list');
        return;
      }
      message.error(loginRes.message || 'URL 参数自动登录失败');
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'URL 参数自动登录失败');
    }
    mode.value = 'credential';
    return;
  }

  if (isLoggedIn()) {
    router.replace('/room-list');
    return;
  }

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

    if (serverConfig.value.hasSdkAppId && serverConfig.value.hasSecretKey) {
      try {
        const loginRes = await login({});
        if (loginRes.code === 0 && loginRes.data) {
          setServerConfigured(true);
          saveCredentials(loginRes.data);
          router.replace('/room-list');
          return;
        }
        message.error(loginRes.message || '自动登录失败，请检查服务器配置');
      } catch (error: unknown) {
        message.error(error instanceof Error ? error.message : '自动登录失败，请检查网络连接');
      }
    }

    formData.sdkAppId = serverConfig.value.hasSdkAppId
      ? String(serverConfig.value.sdkAppId)
      : '';
    mode.value = 'credential';
  } catch {
    mode.value = 'credential';
  }
});

const handleLogin = async () => {
  if (!serverConfig.value.hasSdkAppId && (!formData.sdkAppId.trim() || Number.isNaN(Number(formData.sdkAppId)))) {
    message.error('请输入有效的 SdkAppId');
    return;
  }
  if (!serverConfig.value.hasSecretKey && !formData.userSig.trim()) {
    message.error('请输入 UserSig');
    return;
  }

  loading.value = true;
  try {
    const response = await login({
      userId: formData.userId.trim() || undefined,
      userSig: formData.userSig.trim() || undefined,
      sdkAppId: formData.sdkAppId.trim() ? Number(formData.sdkAppId.trim()) : undefined,
      domain: formData.domain.trim() || undefined,
    });
    if (response.code === 0 && response.data) {
      saveCredentials(response.data);
      message.success('登录成功');
      router.push('/room-list');
    } else {
      message.error(response.message || '登录失败');
    }
  } catch (error: unknown) {
    message.error(error instanceof Error ? error.message : '网络请求失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
@import '@live-manager/common/style/login.css';
</style>
