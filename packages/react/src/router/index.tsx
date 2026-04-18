import { lazy, Suspense, useEffect, useState } from 'react';
import { createHashRouter, Navigate, Outlet, matchRoutes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { isLoggedIn, saveCredentials } from '../api/auth';
import { checkServerConfig } from '@live-manager/common';
import ConfigRequiredPage from '../views/ConfigRequiredPage';
import { Message } from '../components/Toast';
import { useAppNavigate } from '../hooks/useAppNavigate';

const RoomList = lazy(() => import('../views/RoomList'));
const LiveMonitor = lazy(() => import('../views/LiveMonitor'));
const RoomControl = lazy(() => import('../views/RoomControl'));
const GiftConfig = lazy(() => import('../views/GiftConfig'));
const GiftCategory = lazy(() => import('../views/GiftCategory'));
const AnchorLivePlaceholder = lazy(() => import('../views/AnchorLivePlaceholder'));

// 路由守卫组件 - 检查登录状态
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!isLoggedIn()) {
    return <Navigate to='/config-required' replace />;
  }
  return <>{children}</>;
};

// 配置缺失检测组件
const ConfigRequiredRoute: React.FC = () => {
  const navigate = useAppNavigate();
  const [configStatus, setConfigStatus] = useState<{
    loading: boolean;
    missing: string[];
  }>({ loading: true, missing: [] });

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await checkServerConfig();
        const data = res.data;
        if (!data) {
          setConfigStatus({ loading: false, missing: ['SDK_APP_ID', 'SECRET_KEY', 'USER_ID'] });
          return;
        }

        const missing: string[] = [];
        if (!data.hasSdkAppId) missing.push('SDK_APP_ID');
        if (!data.hasSecretKey) missing.push('SECRET_KEY');
        if (!data.hasIdentifier) missing.push('USER_ID');

        setConfigStatus({ loading: false, missing });

        // 服务端配置完整 → 自动登录
        if (missing.length === 0) {
          console.log('[ConfigRequiredRoute] 服务端配置完整，尝试自动登录...');
          try {
            const { login } = await import('../api/auth');
            const loginRes = await login({});
            if (loginRes.code === 0 && loginRes.data) {
              saveCredentials(loginRes.data);
              console.log('[ConfigRequiredRoute] ✅ 自动登录成功');
              navigate('/room-list', { replace: true });
              return;
            } else {
              console.error('[ConfigRequiredRoute] ❌ 自动登录失败:', loginRes.message);
              Message.error(loginRes.message || '自动登录失败');
            }
          } catch (error: any) {
            console.error('[ConfigRequiredRoute] ❌ 自动登录异常:', error);
            Message.error(error.message || '自动登录失败');
          }
        }
      } catch {
        setConfigStatus({ loading: false, missing: ['SDK_APP_ID', 'SECRET_KEY', 'USER_ID'] });
      }
    };

    checkConfig();
  }, [navigate]);

  if (configStatus.loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div>检测配置中...</div>
      </div>
    );
  }

  return <ConfigRequiredPage missingItems={configStatus.missing} />;
};

// 带布局的路由
const LayoutRoute: React.FC = () => {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>}>
          <Outlet />
        </Suspense>
      </MainLayout>
    </ProtectedRoute>
  );
};

// 设置页面标题
const setDocumentTitle = (title?: string) => {
  document.title = `${title || 'LiveKit'} - LiveKit 管理后台`;
};

const routes = [
  {
    path: '/',
    element: <Navigate to='/room-list' replace />,
  },
  {
    path: '/config-required',
    element: <ConfigRequiredRoute />,
    meta: { title: '配置缺失' },
  },
  {
    element: <LayoutRoute />,
    children: [
      {
        path: '/room-list',
        element: <RoomList />,
        meta: { title: '直播间管理' },
      },
      {
        path: '/live-monitor',
        element: <LiveMonitor />,
        meta: { title: '直播监控' },
      },
      {
        path: '/room-control/:roomId',
        element: <RoomControl />,
        meta: { title: '直播间控制台' },
      },
      {
        path: '/gift-config',
        element: <GiftConfig />,
        meta: { title: '礼物配置' },
      },
      {
        path: '/gift-category',
        element: <GiftCategory />,
        meta: { title: '类别管理' },
      },
    ],
  },
  {
    path: '/anchor/live',
    element: (
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>}>
        <AnchorLivePlaceholder />
      </Suspense>
    ),
    meta: { title: '主播开播' },
  },
  {
    path: '/*',
    element: <Navigate to='/room-list' replace />,
  },
];

// 导航守卫 - 设置页面标题
export const router = createHashRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_prependBasename: true,
  },
});

// 根据路径匹配并设置页面标题
const updateTitleByPath = (pathname: string) => {
  const matched = matchRoutes(routes, pathname);
  if (matched && matched.length > 0) {
    for (let i = matched.length - 1; i >= 0; i--) {
      const route = matched[i].route;
      if (route.meta?.title) {
        setDocumentTitle(route.meta.title);
        return;
      }
    }
  }
  setDocumentTitle();
};

// 初始加载时立即设置标题（subscribe 只在路由变化时触发，不包含首次加载）
updateTitleByPath(router.state.location.pathname);

// 使用 router 的 subscribe 监听路由变化设置标题
let previousPath = router.state.location.pathname;
router.subscribe((routerState) => {
  const currentPath = routerState.location.pathname;
  if (currentPath !== previousPath) {
    previousPath = currentPath;
    updateTitleByPath(currentPath);
  }
});

export default router;
