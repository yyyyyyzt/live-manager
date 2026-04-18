import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ViewModuleIcon,
  VideoCamera1Icon,
  GiftIcon,
  UserIcon,
  ChevronDownIcon,
  LogoutIcon,
} from "tdesign-icons-react";
import {
  useLiveMonitorState,
  useLoginState,
  useLiveListState,
} from "tuikit-atomicx-react";
import {
  clearCredentials,
  getUserProfilePortrait,
  login,
  isServerConfiguredMode,
  getCredentials,
  getCurrentUserId,
} from "../api/auth";
import {
  clearCache,
  isUrlOverrideMode,
  getUrlOverrideParams,
} from "@live-manager/common";
import { useAppNavigate } from "../hooks/useAppNavigate";
import type { UserPortraitProfile } from "../api/auth";
import "./MainLayout.css";

const PAGE_TITLE_MAP: Record<string, string> = {
  "room-list": "直播间管理",
  "live-monitor": "直播监控",
  "gift-config": "礼物配置",
  "room-control": "直播间控制台",
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useAppNavigate();
  const location = useLocation();
  const { init } = useLiveMonitorState();
  const { login: tuikitLogin } = useLoginState();
  const { leaveLive } = useLiveListState();
  const [, setSdkReady] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserPortraitProfile | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef<string>(location.pathname);
  const sdkInitializedRef = useRef<boolean>(false);

  // 判断是否需要显示退出登录：凭证模式时需要
  const showLogout = !isServerConfiguredMode() && !isUrlOverrideMode();
  const fallbackUserName = currentUserId || '管理员';
  const displayUserName = userProfile?.nick || fallbackUserName;

  useEffect(() => {
    if (!currentUserId) {
      setUserProfile(null);
      setAvatarLoadFailed(false);
      return;
    }

    let cancelled = false;

    void getUserProfilePortrait(currentUserId)
      .then((profile) => {
        if (cancelled) return;
        setUserProfile(profile);
        setAvatarLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUserProfile(null);
        setAvatarLoadFailed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  // 初始化 LiveKit SDK + TUILogin（joinLive 时 RTCLoginServer.login() 从 TUILogin.getContext() 取 sdkAppId，必须同时 login）
  useEffect(() => {
    console.log("MainLayout - SDK init effect running");

    // 防止 Strict Mode 下重复初始化（每次会生成不同的随机 userId，导致身份混乱）
    if (sdkInitializedRef.current) {
      console.log("MainLayout - SDK already initialized, skipping");
      return;
    }
    sdkInitializedRef.current = true;

    const doInit = async () => {
      let account: { sdkAppId: number; userId: string; userSig: string } | undefined;

      // URL 覆盖模式：不在此处初始化 SDK，但需要获取服务器配置的 userId
      if (isUrlOverrideMode()) {
        console.log("MainLayout - URL override mode, skipping SDK init (will init in room-control)");

        const urlOverride = getUrlOverrideParams();
        if (urlOverride) {
          try {
            const loginRes = await login({ sdkAppId: urlOverride.sdkAppId, secretKey: urlOverride.secretKey });
            if (loginRes.code === 0 && loginRes.data) {
              localStorage.setItem('user_id', loginRes.data.userId);
              localStorage.setItem('user_sig', loginRes.data.userSig);
              localStorage.setItem('sdk_app_id', String(loginRes.data.sdkAppId));
              setCurrentUserId(loginRes.data.userId);
              console.log('MainLayout - URL override login success, userId:', loginRes.data.userId);
            }
          } catch (err) {
            console.error('MainLayout - Failed to login with URL override:', err);
          }
        }
        return;
      }

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
            console.log("MainLayout - Server configured mode, userId:", account.userId);
          }
        } catch (err) {
          console.error("MainLayout - Failed to get credentials from server:", err);
        }
      }
      // 2. 凭证模式：从 sessionStorage 读取
      else {
        const creds = getCredentials();
        if (creds) {
          account = creds;
          console.log("MainLayout - Credential mode, userId:", account.userId);
        }
      }

      if (account && account.sdkAppId !== 0) {
        initAndLogin(account);
      } else {
        console.error("MainLayout - No valid credentials found");
      }
    };

    const initAndLogin = (account: { sdkAppId: number; userId: string; userSig: string }) => {
      console.log("MainLayout - Initializing SDK with sdkAppId:", account.sdkAppId);
      setCurrentUserId(account.userId);
      try {
        init({
          baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:9000/api",
          account: {
            sdkAppId: account.sdkAppId,
            userId: account.userId,
            password: account.userSig,
          },
        });
        console.log("MainLayout - init() called successfully");

        tuikitLogin({
          SDKAppID: account.sdkAppId,
          userID: account.userId,
          userSig: account.userSig,
        })
          .then(() => {
            console.log("MainLayout - TUILogin login done");
            setSdkReady(true);
          })
          .catch((err) => {
            if (err?.code === 2025 || err?.message?.includes('重复登录')) {
              console.log("MainLayout - User already logged in (repeat login), continuing");
              setSdkReady(true);
            } else {
              console.error("MainLayout - TUILogin login error:", err);
            }
          });
      } catch (err) {
        console.error("MainLayout - SDK init error:", err);
      }
    };

    doInit();
  }, [init, tuikitLogin]);

  // 当前激活的菜单项
  const [activeMenu, setActiveMenu] = useState("room-list");

  // 监听路由变化，更新菜单状态
  useEffect(() => {
    const pathName = location.pathname.split("/")[1];
    if (pathName && PAGE_TITLE_MAP[pathName]) {
      setActiveMenu(pathName);
    }
  }, [location.pathname]);

  // 监听路由变化，离开 LiveMonitor 或 RoomControl 页面时退出房间
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // 检查是否从 LiveMonitor 或 RoomControl 页面离开
    const wasInLivePage = previousPath.startsWith('/live-monitor') || previousPath.startsWith('/room-control');
    const isNowInOtherPage = !currentPath.startsWith('/live-monitor') && !currentPath.startsWith('/room-control');

    if (wasInLivePage && isNowInOtherPage) {
      console.log('离开直播页面，执行退房清理');
      void leaveLive().catch((err) => {
        console.error('退出房间失败:', err);
      });
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, leaveLive]);

  // 处理菜单点击
  const handleMenuClick = (path: string) => {
    navigate(`/${path}`);
  };

  // 处理退出登录
  const handleLogout = () => {
    setUserMenuOpen(false);
    clearCredentials();
    clearCache();
    navigate("/login");
  };

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const renderUserAvatar = () => (
    <div className="user-avatar">
      {userProfile?.avatarUrl && !avatarLoadFailed ? (
        <img
          className="user-avatar-image"
          src={userProfile.avatarUrl}
          alt={`${displayUserName}头像`}
          referrerPolicy="no-referrer"
          onError={() => setAvatarLoadFailed(true)}
        />
      ) : (
        <UserIcon size="16px" />
      )}
    </div>
  );

  return (
    <div className="main-layout">
      {/* 顶部导航栏 */}
      <header className="main-header">
        <div className="header-left">
          {/* Logo */}
          <div className="header-logo">
            <img src="data:image/svg+xml,%3csvg%20width='26'%20height='25'%20viewBox='0%200%2026%2025'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M19.031%208.43442C18.9368%208.42827%2018.8012%208.50613%2018.5299%208.66187L11.5925%2012.6453C11.0526%2012.9553%2010.7827%2013.1102%2010.5756%2013.3163C10.2995%2013.5909%2010.1009%2013.9331%209.99988%2014.3084C9.92407%2014.5899%209.92407%2014.9%209.92407%2015.5203V21.861C9.92407%2023.4502%2011.2185%2024.7384%2012.8152%2024.7384C14.1242%2024.7384%2015.2699%2023.863%2015.6081%2022.6044L19.2143%209.18442C19.2952%208.88336%2019.3357%208.73283%2019.3053%208.64388C19.2648%208.52529%2019.1565%208.44263%2019.031%208.43442Z'%20fill='%230C60F2'/%3e%3cpath%20d='M9.46288%202.58624C9.32855%202.54566%209.15969%202.5676%208.82197%202.61148L5.24075%203.0768C1.0721%203.61845%20-1.25921%208.14035%200.733978%2011.8183C2.3403%2014.7825%206.09573%2015.839%209.02759%2014.1517L9.03052%2014.15C9.58315%2013.8313%209.9235%2013.2447%209.92407%2012.6098L9.92408%203.57267C9.92408%203.23425%209.92408%203.06504%209.86616%202.93796C9.78894%202.76852%209.64198%202.64035%209.46288%202.58624Z'%20fill='%230095FF'/%3e%3cpath%20d='M10.9577%203.1626L17.953%207.2243C18.4371%207.50542%2018.6792%207.64598%2018.9329%207.71423C19.2711%207.80522%2019.6272%207.80491%2019.9652%207.71334C20.2188%207.64465%2020.4606%207.50367%2020.9443%207.22172L24.6956%205.03497C25.5064%204.56233%2025.949%203.63997%2025.8127%202.70699C25.6309%201.46278%2024.491%200.595394%2023.252%200.75846L11.1174%202.35548C10.7755%202.40048%2010.6046%202.42298%2010.537%202.4866C10.4469%202.57141%2010.4206%202.70457%2010.4715%202.81765C10.5097%202.90246%2010.659%202.98918%2010.9577%203.1626Z'%20fill='%2300CCFF'/%3e%3c/svg%3e" alt="logo"/>
            <span className="logo-text">LiveKit</span>
          </div>
          <div className="header-divider" />
          <h1 className="page-title">直播间后台管理</h1>
        </div>

        <div className="header-right">
          {showLogout ? (
            <div className="user-menu-wrapper" ref={userMenuRef}>
              <div className="user-menu" onClick={() => setUserMenuOpen((prev) => !prev)}>
                {renderUserAvatar()}
                <span className="user-name">{displayUserName}</span>
                <ChevronDownIcon size="16px" className={`user-chevron ${userMenuOpen ? 'rotated' : ''}`} />
              </div>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-item" onClick={handleLogout}>
                    <LogoutIcon size="14px" />
                    <span>退出登录</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="user-menu">
              {renderUserAvatar()}
              <span className="user-name">{displayUserName}</span>
            </div>
          )}
        </div>
      </header>

      <div className="main-body">
        {/* 侧边栏 */}
        <aside className="main-sidebar">
          <div className="sidebar-content">
            {/* 导航菜单 */}
            <nav className="sidebar-menu">
              <div
                className={`menu-item ${
                  activeMenu === "live-monitor" ? "active" : ""
                }`}
                onClick={() => handleMenuClick("live-monitor")}
              >
                <VideoCamera1Icon size="18px" />
                <span>直播监控</span>
              </div>
              <div
                className={`menu-item ${
                  activeMenu === "room-list" ? "active" : ""
                }`}
                onClick={() => handleMenuClick("room-list")}
              >
                <ViewModuleIcon size="18px" />
                <span>直播间管理</span>
              </div>
              <div
                className={`menu-item ${
                  activeMenu === "gift-config" ? "active" : ""
                }`}
                onClick={() => handleMenuClick("gift-config")}
              >
                <GiftIcon size="18px" />
                <span>礼物配置</span>
              </div>
            </nav>
          </div>


        </aside>

        {/* 页面内容 */}
        <main className="main-content">
          <div className="content-wrapper">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
