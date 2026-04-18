<template>
  <div class="main-layout">
    <!-- 顶部导航栏 -->
    <header class="main-header">
      <div class="header-left">
        <!-- Logo -->
        <div class="header-logo">
          <img src="data:image/svg+xml,%3csvg%20width='26'%20height='25'%20viewBox='0%200%2026%2025'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M19.031%208.43442C18.9368%208.42827%2018.8012%208.50613%2018.5299%208.66187L11.5925%2012.6453C11.0526%2012.9553%2010.7827%2013.1102%2010.5756%2013.3163C10.2995%2013.5909%2010.1009%2013.9331%209.99988%2014.3084C9.92407%2014.5899%209.92407%2014.9%209.92407%2015.5203V21.861C9.92407%2023.4502%2011.2185%2024.7384%2012.8152%2024.7384C14.1242%2024.7384%2015.2699%2023.863%2015.6081%2022.6044L19.2143%209.18442C19.2952%208.88336%2019.3357%208.73283%2019.3053%208.64388C19.2648%208.52529%2019.1565%208.44263%2019.031%208.43442Z'%20fill='%230C60F2'/%3e%3cpath%20d='M9.46288%202.58624C9.32855%202.54566%209.15969%202.5676%208.82197%202.61148L5.24075%203.0768C1.0721%203.61845%20-1.25921%208.14035%200.733978%2011.8183C2.3403%2014.7825%206.09573%2015.839%209.02759%2014.1517L9.03052%2014.15C9.58315%2013.8313%209.9235%2013.2447%209.92407%2012.6098L9.92408%203.57267C9.92408%203.23425%209.92408%203.06504%209.86616%202.93796C9.78894%202.76852%209.64198%202.64035%209.46288%202.58624Z'%20fill='%230095FF'/%3e%3cpath%20d='M10.9577%203.1626L17.953%207.2243C18.4371%207.50542%2018.6792%207.64598%2018.9329%207.71423C19.2711%207.80522%2019.6272%207.80491%2019.9652%207.71334C20.2188%207.64465%2020.4606%207.50367%2020.9443%207.22172L24.6956%205.03497C25.5064%204.56233%2025.949%203.63997%2025.8127%202.70699C25.6309%201.46278%2024.491%200.595394%2023.252%200.75846L11.1174%202.35548C10.7755%202.40048%2010.6046%202.42298%2010.537%202.4866C10.4469%202.57141%2010.4206%202.70457%2010.4715%202.81765C10.5097%202.90246%2010.659%202.98918%2010.9577%203.1626Z'%20fill='%2300CCFF'/%3e%3c/svg%3e" alt="logo"/>
          <span class="logo-text">LiveKit</span>
        </div>
        <div class="header-divider" />
        <h1 class="page-title">直播间后台管理</h1>
      </div>

      <div class="header-right">
        <div v-if="showLogout" class="user-menu-wrapper" ref="userMenuRef">
          <div class="user-menu" @click="toggleUserMenu">
            <div class="user-avatar">
              <img
                v-if="userProfile?.avatarUrl && !avatarLoadFailed"
                class="user-avatar-image"
                :src="userProfile.avatarUrl"
                :alt="`${displayUserName}头像`"
                referrerpolicy="no-referrer"
                @error="avatarLoadFailed = true"
              />
              <UserIcon v-else />
            </div>
            <span class="user-name">{{ displayUserName }}</span>
            <ChevronDownIcon class="user-chevron" :class="{ rotated: userMenuOpen }" />
          </div>
          <div v-if="userMenuOpen" class="user-dropdown">
            <div class="user-dropdown-item" @click="handleLogout">
              <LogoutIcon />
              <span>退出登录</span>
            </div>
          </div>
        </div>
        <div v-else class="user-menu">
          <div class="user-avatar">
            <img
              v-if="userProfile?.avatarUrl && !avatarLoadFailed"
              class="user-avatar-image"
              :src="userProfile.avatarUrl"
              :alt="`${displayUserName}头像`"
              referrerpolicy="no-referrer"
              @error="avatarLoadFailed = true"
            />
            <UserIcon v-else />
          </div>
          <span class="user-name">{{ displayUserName }}</span>
        </div>
      </div>
    </header>

    <div class="main-body">
      <!-- 侧边栏 -->
      <aside class="main-sidebar">
        <div class="sidebar-content">
          <!-- 导航菜单 -->
          <nav class="sidebar-menu">
            <div
              class="menu-item"
              :class="{ active: activeMenu === 'live-monitor' }"
              @click="handleMenuClick('live-monitor')"
            >
              <VideoCamera1Icon />
              <span>直播监控</span>
            </div>
            <div
              class="menu-item"
              :class="{ active: activeMenu === 'room-list' }"
              @click="handleMenuClick('room-list')"
            >
              <ViewModuleIcon />
              <span>直播间管理</span>
            </div>
            <div
              class="menu-item"
              :class="{ active: activeMenu === 'gift-config' }"
              @click="handleMenuClick('gift-config')"
            >
              <GiftIcon />
              <span>礼物配置</span>
            </div>
          </nav>
        </div>
      </aside>

      <!-- 页面内容 -->
      <main class="main-content">
        <div class="content-wrapper">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { VideoCamera1Icon, ViewModuleIcon, GiftIcon, UserIcon, ChevronDownIcon, LogoutIcon } from 'tdesign-icons-vue-next';
import { useLiveMonitorState, useLoginState } from 'tuikit-atomicx-vue3/live';
import {
  clearCredentials,
  getUserProfilePortrait,
  clearCache,
  isUrlOverrideMode,
  getUrlOverrideParams,
  login,
  isServerConfiguredMode,
  getCredentials,
  getCurrentUserId,
} from '@/api/auth';
import type { UserPortraitProfile } from '@/api/auth';

const PAGE_TITLE_MAP: Record<string, string> = {
  'room-list': '直播间管理',
  'live-monitor': '直播监控',
  'gift-config': '礼物配置',
  'room-control': '直播间控制台',
  'gift-category': '礼物分类',
};

const router = useRouter();
const route = useRoute();

const userMenuOpen = ref(false);
const userProfile = ref<UserPortraitProfile | null>(null);
const avatarLoadFailed = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

// 当前激活的菜单项
const activeMenu = ref('room-list');

// SDK 就绪状态 - 提供给子组件使用
const sdkReady = ref(false);
provide('sdkReady', sdkReady);

// SDK 实际使用的 userId
// Vue SDK 的 useLoginState().loginUserInfo 登录后不更新（bug），所以需要手动管理
const sdkUserId = ref('');
provide('sdkUserId', sdkUserId);

// 判断是否需要显示退出登录：凭证模式时需要
const showLogout = computed(() => !isServerConfiguredMode() && !isUrlOverrideMode());
const currentUserId = computed(() => sdkUserId.value || getCurrentUserId() || '');
const fallbackUserName = computed(
  () => currentUserId.value || '管理员'
);
const displayUserName = computed(
  () => userProfile.value?.nick || fallbackUserName.value
);

// 获取用户资料
watch(currentUserId, (newUserId) => {
  if (!newUserId) {
    userProfile.value = null;
    avatarLoadFailed.value = false;
    return;
  }

  let cancelled = false;
  getUserProfilePortrait(newUserId)
    .then((profile) => {
      if (cancelled) return;
      userProfile.value = profile;
      avatarLoadFailed.value = false;
    })
    .catch(() => {
      if (cancelled) return;
      userProfile.value = null;
      avatarLoadFailed.value = false;
    });

  return () => {
    cancelled = true;
  };
}, { immediate: true });

const { init } = useLiveMonitorState();
const { login: tuikitLogin } = useLoginState();

// 初始化 LiveKit SDK + TUILogin
// URL 覆盖模式下不在此处初始化，由直播间详情页按需初始化
const initSDK = async () => {
  // URL 覆盖模式：不在此处初始化 SDK，但需要获取服务器配置的 userId
  if (isUrlOverrideMode()) {
    console.log('MainLayout - URL override mode, skipping SDK init (will init in room-control)');

    const urlOverride = getUrlOverrideParams();
    if (urlOverride) {
      try {
        const loginRes = await login({ sdkAppId: urlOverride.sdkAppId, secretKey: urlOverride.secretKey });
        if (loginRes.code === 0 && loginRes.data) {
          localStorage.setItem('user_id', loginRes.data.userId);
          localStorage.setItem('user_sig', loginRes.data.userSig);
          localStorage.setItem('sdk_app_id', String(loginRes.data.sdkAppId));
          sdkUserId.value = loginRes.data.userId;
          console.log('MainLayout - URL override login success, userId:', loginRes.data.userId);
        }
      } catch (err) {
        console.error('MainLayout - Failed to login with URL override:', err);
      }
    }
    return;
  }

  let account: { sdkAppId: number; userId: string; userSig: string } | undefined;

  // 1. 服务端配置模式：调用 login API 获取凭证
  if (isServerConfiguredMode()) {
    try {
      const loginRes = await login({});
      if (loginRes.code === 0 && loginRes.data) {
        account = {
          sdkAppId: loginRes.data.sdkAppId,
          userId: loginRes.data.userId,
          userSig: loginRes.data.userSig,
        };
        console.log('MainLayout - Server configured mode, userId:', account.userId);
      }
    } catch (err) {
      console.error('MainLayout - Failed to get credentials from server:', err);
    }
  }
  // 2. 凭证模式：从 sessionStorage 读取
  else {
    const creds = getCredentials();
    if (creds) {
      account = creds;
      console.log('MainLayout - Credential mode, userId:', account.userId);
    }
  }

  if (account && account.sdkAppId !== 0) {
    // 保存 SDK 实际使用的 userId，供子组件使用
    sdkUserId.value = account.userId;

    try {
      init({
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api',
        account: {
          sdkAppId: account.sdkAppId,
          userId: account.userId,
          password: account.userSig,
        },
      });

      // 必须调用 tuikitLogin 设置 context，否则 joinLive -> ensureLogin -> RTCLoginServer.login()
      // 会从 TUILogin.getContext() 拿到 SDKAppID=0 报错
      tuikitLogin({
        SDKAppID: account.sdkAppId,
        userID: account.userId,
        userSig: account.userSig,
      })
        .then(() => {
          console.log('MainLayout - TUILogin login done, sdkUserId:', account!.userId);
          sdkReady.value = true;
        })
        .catch((err: any) => {
          // 错误码 2025 表示重复登录，可以忽略
          if (err?.code === 2025 || err?.message?.includes('重复登录')) {
            console.log('MainLayout - User already logged in (repeat login), continuing');
            sdkReady.value = true;
          } else {
            console.error('MainLayout - TUILogin login error:', err);
          }
        });
    } catch (err) {
      console.error('MainLayout - SDK init error:', err);
    }
  } else {
    console.error('MainLayout - SDK AppID not configured or account is invalid');
  }
};

// 点击外部关闭用户菜单
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  initSDK();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// 监听路由变化，更新菜单状态
watch(
  () => route.path,
  (path) => {
    const pathName = path.split('/')[1];
    if (pathName && PAGE_TITLE_MAP[pathName]) {
      activeMenu.value = pathName;
    }
  },
  { immediate: true }
);

// 处理菜单点击
const handleMenuClick = (path: string) => {
  router.push(`/${path}`);
};

// 处理退出登录
const handleLogout = () => {
  userMenuOpen.value = false;
  clearCredentials();
  clearCache();
  router.push('/login');
};

// 切换用户菜单
const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value;
};

// 点击外部关闭用户菜单
const handleClickOutside = (event: MouseEvent) => {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    userMenuOpen.value = false;
  }
};
</script>

<style scoped>
/* 主布局 */
.main-layout {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F5F7FA;
}

/* 顶部导航栏 */
.main-header {
  height: 48px;
  background: #FFFFFF;
  border-bottom: 1px solid #EAEDF2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #1D2129;
}

.header-divider {
  width: 1px;
  height: 16px;
  background: #EAEDF2;
}

.page-title {
  font-size: 18px;
  font-weight: 550;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-menu:hover {
  background: #F7F8FA;
}

.user-avatar {
  width: 28px;
  height: 28px;
  background: #F2F3F5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4E5969;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-name {
  font-size: 14px;
  color: #1D2129;
}

.user-chevron {
  color: #86909C;
  transition: transform 0.2s;
}

.user-chevron.rotated {
  transform: rotate(180deg);
}

/* 用户菜单容器 */
.user-menu-wrapper {
  position: relative;
}

/* 用户下拉菜单 */
.user-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  background: #FFFFFF;
  border: 1px solid #EAEDF2;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 4px;
  z-index: 100;
}

.user-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #4E5969;
  cursor: pointer;
  transition: all 0.2s;
}

.user-dropdown-item:hover {
  background: #FFF1F0;
  color: #E34D59;
}

/* 主体布局 */
.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 侧边栏 */
.main-sidebar {
  width: 200px;
  background: #FFFFFF;
  border-right: 1px solid #EAEDF2;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

/* 侧边栏菜单 */
.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #4E5969;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #F7F8FA;
  color: #1D2129;
}

.menu-item.active {
  background: #F1F6FF;
  color: #1C66E5;
  font-weight: 500;
}

/* 主内容区 */
.main-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: #F5F7FA;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-x: auto;
  padding: 24px;
}

/* 响应式 */
@media (max-width: 768px) {
  .main-sidebar {
    width: 60px;
  }

  .menu-item span {
    display: none;
  }

  .menu-item {
    justify-content: center;
    padding: 0;
  }
}
</style>
