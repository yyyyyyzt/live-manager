<!--
  * 名称：ViewerSmokeView
  * 说明：观众侧「先审后发」联调页；请求经 Vite 代理至 audit-server。
-->
<template>
  <div id="viewerSmokeRoot" class="viewer-page">
    <n-page-header title="观众联调" subtitle="评论先审后发 · Demo" @back="goBack" />
    <n-card title="投稿" size="small" class="viewer-card">
      <n-form ref="formRef" :model="form" label-placement="top">
        <n-form-item label="房间 ID" path="roomId" :rule="{ required: true, message: '必填' }">
          <n-input v-model:value="form.roomId" placeholder="room_xxx" />
        </n-form-item>
        <n-form-item label="昵称">
          <n-input v-model:value="form.author" placeholder="观众昵称" />
        </n-form-item>
        <n-form-item label="评论内容" path="text" :rule="{ required: true, message: '必填' }">
          <n-input v-model:value="form.text" type="textarea" placeholder="输入评论" :rows="3" />
        </n-form-item>
        <n-button type="primary" :loading="submitting" @click="submit">提交审核</n-button>
      </n-form>
      <n-p v-if="lastResponse" depth="3" class="viewer-result">{{ lastResponse }}</n-p>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import type { FormInst } from 'naive-ui';

const router = useRouter();
const message = useMessage();
const formRef = ref<FormInst | null>(null);
const submitting = ref(false);
const lastResponse = ref('');

const form = reactive({
  roomId: '',
  author: 'demo_viewer',
  text: '',
});

const goBack = () => {
  router.push('/room-list');
};

const submit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  lastResponse.value = '';
  try {
    const res = await fetch(`/audit-api/api/v1/rooms/${encodeURIComponent(form.roomId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: form.author, text: form.text }),
    });
    const json = await res.json();
    lastResponse.value = JSON.stringify(json, null, 2);
    if (json.code === 0) {
      message.success('已提交，待审核');
      form.text = '';
    } else {
      message.error(json.message || '提交失败');
    }
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '网络错误');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped lang="scss">
.viewer-page {
  padding: 24px;
  max-width: 560px;
  margin: 0 auto;
}

.viewer-card {
  margin-top: 16px;
}

.viewer-result {
  margin-top: 16px;
  white-space: pre-wrap;
  font-size: 12px;
}
</style>
