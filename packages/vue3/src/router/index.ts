import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { isLoggedIn, saveCredentials } from '@/api/auth';
import { getUrlOverrideParams, checkServerConfig } from '@live-manager/common';
import { ref } from 'vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/room-list',
  },
  {
    path: '/config-required',
    name: 'config-required',
    component: () => import('@/views/config-required.vue'),
    meta: { title: '配置缺失' },
  },
  {
    path: '/host',
    name: 'host-studio',
    component: () => import('@/views/host/HostStudioView.vue'),
    meta: { title: '主播端' },
  },
  {
    path: '/viewer-smoke',
    name: 'viewer-smoke',
    component: () => import('@/views/viewer/ViewerSmokeView.vue'),
    meta: { title: '观众联调' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: 'room-list',
        name: 'room-list',
        component: () => import('@/views/room-list.vue'),
        meta: { title: '直播间管理', requiresAuth: true },
      },
      {
        path: 'live-monitor',
        name: 'live-monitor',
        component: () => import('@/views/live-monitor.vue'),
        meta: { title: '直播监控', requiresAuth: true },
      },
      {
        path: 'room-control/:roomId',
        name: 'room-control',
        component: () => import('@/views/room-control.vue'),
        meta: { title: '直播间控制台', requiresAuth: true },
      },
      {
        path: 'gift-config',
        name: 'gift-config',
        component: () => import('@/views/gift-config.vue'),
        meta: { title: '礼物配置', requiresAuth: true },
      },
      {
        path: 'gift-category',
        name: 'gift-category',
        component: () => import('@/views/gift-category.vue'),
        meta: { title: '类别管理', requiresAuth: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/room-list',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 配置状态缓存
const configStatus = ref<{
  checked: boolean;
  missing: string[];
}>({ checked: false, missing: [] });

// 检查配置状态
async function checkConfigStatus() {
  if (configStatus.value.checked) return configStatus.value;

  try {
    const res = await checkServerConfig();
    const data = res.data;
    if (!data) {
      configStatus.value = { checked: true, missing: ['SDK_APP_ID', 'SECRET_KEY', 'USER_ID'] };
      return configStatus.value;
    }

    const missing: string[] = [];
    if (!data.hasSdkAppId) missing.push('SDK_APP_ID');
    if (!data.hasSecretKey) missing.push('SECRET_KEY');
    if (!data.hasIdentifier) missing.push('USER_ID');

    configStatus.value = { checked: true, missing };
  } catch {
    configStatus.value = { checked: true, missing: ['SDK_APP_ID', 'SECRET_KEY', 'USER_ID'] };
  }

  return configStatus.value;
}

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  // 设置页面标题
  document.title = `${to.meta.title || 'LiveKit'} - LiveKit 管理后台`;

  // 跳过配置缺失页面自身
  if (to.name === 'config-required') {
    next();
    return;
  }

  // 检查登录状态
  if (to.meta.requiresAuth) {
    if (!isLoggedIn()) {
      // 先检查配置状态
      const status = await checkConfigStatus();
      if (status.missing.length > 0) {
        // 通过 query 传递缺失项
        next({ name: 'config-required', query: { missing: status.missing.join(',') } });
        return;
      }
      // 服务端配置完整 → 自动登录
      console.log('[Router] 服务端配置完整，尝试自动登录...');
      try {
        const { login: doLogin } = await import('@/api/auth');
        const loginRes = await doLogin({});
        if (loginRes.code === 0 && loginRes.data) {
          saveCredentials(loginRes.data);
          console.log('[Router] ✅ 自动登录成功');
          next();
          return;
        } else {
          console.error('[Router] ❌ 自动登录失败:', loginRes.message);
        }
      } catch (error: any) {
        console.error('[Router] ❌ 自动登录异常:', error);
      }
      next({ name: 'config-required' });
      return;
    }
  }

  // URL 覆盖模式：确保跳转时不丢失 sdkAppId/secretKey 参数
  const override = getUrlOverrideParams();
  if (override) {
    const hasAppId = to.query.sdkAppId !== undefined;
    const hasSecret = to.query.secretKey !== undefined;
    if (!hasAppId || !hasSecret) {
      next({
        ...to,
        query: {
          ...to.query,
          sdkAppId: String(override.sdkAppId),
          secretKey: override.secretKey,
        },
      });
      return;
    }
  }

  next();
});

export default router;
