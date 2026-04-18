import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@tencentcloud/uikit-base-component-vue3/dist/styles/index.css';
import '@live-manager/common/style/global.css';
import App from './App.vue';
import router from './router/index';
import './assets/styles/variables.css';
import './assets/styles/index.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
