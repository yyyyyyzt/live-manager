<!--
  * 名称：App
  * 说明：根组件；挂载 Naive UI 全局反馈与 Tencent UIKit Provider。
-->
<template>
  <n-config-provider>
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <UIKitProvider theme="light">
            <router-view />
          </UIKitProvider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script lang="ts" setup>
import { UIKitProvider, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { enResource, zhResource, addI18n } from './i18n';

const { setLanguage } = useUIKit();

addI18n('en-US', { translation: enResource });
addI18n('zh-CN', { translation: zhResource });
setLanguage(navigator.language);
</script>

<style>
* {
  box-sizing: border-box;
  font-family: 'PingFang SC', system-ui, sans-serif;
}

body {
  margin: 0;
  padding: 0;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
