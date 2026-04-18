import { createApp } from 'vue';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import '@tencentcloud/uikit-base-component-vue3/dist/styles/index.css';
import '@live-manager/common/style/global.css';
import App from './App.vue';
import router from './router/index';
import './assets/styles/variables.css';
import './assets/styles/index.css';

const app = createApp(App);
app.use(TDesign);
app.use(router);
app.mount('#app');
