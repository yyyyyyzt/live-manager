import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAppNavigate } from "../hooks/useAppNavigate";
import { ArrowLeft, Info } from "lucide-react";
import { Loading, Button, Dialog, Tooltip, Tabs } from 'tdesign-react';
import { StopCircleIcon, MoreIcon, ChatOffIcon, UserBlockedIcon, CheckCircleIcon } from "tdesign-icons-react";
import {
  LiveView,
  LiveAudienceList,
  useLiveListState,
  useLiveAudienceState,
  useLiveLikeState,
  useRoomEngine,
  useLoginState,
  useLiveMonitorState,
  LiveListEvent,
} from "tuikit-atomicx-react";
import AnchorAvatar, {
  resolveAnchorAvatarUrl,
  resolveAnchorDisplayName,
} from "../components/AnchorAvatar";
import MessageList from "../components/MessageList";
import ModerationQueuePanel from "../components/ModerationQueuePanel";
import RobotRulesPanel from "../components/RobotRulesPanel";
import { Message } from "../components/Toast";
import type { RoomInfo } from "../types";
import { getRoomDetail, getRoomStatistic, banRoom, muteMember, banMember, unmuteMember, unbanMember, getBannedMemberList, getMutedMemberList } from "../api/room";
import {
  batchGetUserProfilePortrait,
  isUrlOverrideMode,
} from "../api/auth";
import { DIALOG_WIDTH, getErrorMessage, defaultCoverUrl } from "@live-manager/common";
import { copyText } from "../utils";
import { buildAnchorLiveEntryUrl } from "../utils/anchorEntry";
import "@live-manager/common/components/user-action-dropdown/user-action-dropdown.css";
import "./RoomControl.css";

export default function RoomControl() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useAppNavigate();
  const roomEngine = useRoomEngine();
  const { currentLive, leaveLive, subscribeEvent, unsubscribeEvent, joinLive } =
    useLiveListState();
  const { audienceList, audienceCount } = useLiveAudienceState();

  // 根据 userId 查找观众头像
  const getUserAvatar = (userId: string) => {
    const audience = audienceList.find((a) => a.userId === userId);
    return (audience as unknown as Record<string, unknown>)?.avatarUrl as string | undefined;
  };
  // 根据 userId 获取用户名称（优先使用缓存的用户资料）
  const getUserNameFromCache = (userId: string) => {
    // 先从观众列表中查找
    const audience = audienceList.find((a) => a.userId === userId);
    if (audience?.userName) {
      return audience.userName;
    }
    // 再从缓存的用户资料中查找
    const profile = userProfileCache.get(userId);
    if (profile?.nick) {
      return profile.nick;
    }
    // 最后返回 userId
    return userId;
  };
  const { loginUserInfo, login: tuikitLogin } = useLoginState();
  const { totalLikeCount } = useLiveLikeState();
  const { init } = useLiveMonitorState();
  const [sdkReady, setSdkReady] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [liveEndedOverlayVisible, setLiveEndedOverlayVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "audience" | "moderation" | "robot">("chat");
  const [loading, setLoading] = useState(true);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [createTime, setCreateTime] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    content: string;
    onConfirm: () => void;
  } | null>(null);

  const [mutedList, setMutedList] = useState<Array<{ userId: string; endTime: number }>>([]);
  const [bannedList, setBannedList] = useState<Array<{ userId: string; endTime: number }>>([]);
  const [memberListLoading, setMemberListLoading] = useState(false);
  // 用户资料缓存（用于禁言/封禁列表显示用户名）
  const [userProfileCache, setUserProfileCache] = useState<Map<string, { nick: string; avatarUrl: string }>>(new Map());

  // 观众操作下拉菜单状态
  const [audienceDropdown, setAudienceDropdown] = useState<{
    visible: boolean;
    userId: string;
    userName: string;
    isMuted: boolean;
    x: number;
    y: number;
  } | null>(null);

  // 禁言/封禁列表弹框状态
  const [mutedModalVisible, setMutedModalVisible] = useState(false);
  const [bannedModalVisible, setBannedModalVisible] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 主播资料缓存（通过 API 获取的头像和昵称）
  const [anchorProfile, setAnchorProfile] = useState<{ nick: string; avatarUrl: string } | null>(null);

  const [stats, setStats] = useState({
    onlineCount: 0,
    totalViewers: 0,
    totalMsgCount: 0,
    totalLikesReceived: 0,
    totalGiftsSent: 0,
    totalGiftCoins: 0,
    totalUniqueGiftSenders: 0,
  });

  // 刷新频率选项（单位：秒）
  const refreshOptions = [
    { label: "关闭", value: 0 },
    { label: "10秒", value: 10 },
    { label: "30秒", value: 30 },
    { label: "1分钟", value: 60 },
    { label: "5分钟", value: 300 },
  ];
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // 默认30秒

  const durationTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const isComponentMounted = useRef<boolean>(true);
  const hasJoinedLiveRef = useRef<boolean>(false);
  const isRoomValidRef = useRef<boolean>(true);

  const anchorUserId = useMemo(
    () => currentLive?.liveOwner?.userId || roomInfo?.anchor.id || "",
    [currentLive, roomInfo]
  );

  const handleLiveEnded = useCallback(() => {
    setLiveEndedOverlayVisible(true);
    // 清除直播时长定时器，防止直播结束后时长还在跳动
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const showMessage = (type: "success" | "error", msg: string) => {
    if (type === "success") {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 3000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // 获取错误码和错误信息
  const getErrorInfo = (error: any): { code: number; info: string } => {
    const code = error?.ErrorCode || error?.errorCode || error?.code || 0;
    const info = error?.ErrorInfo || error?.errorInfo || "";
    return { code, info };
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + "w";
    }
    return num.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const hms = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return days > 0 ? `${days}天 ${hms}` : hms;
  };

  const handleLeaveLive = useCallback(async () => {
    try {
      await leaveLive();
      navigate(-1);
    } catch (error) {
      console.error("Failed to leave live:", error);
    }
  }, [leaveLive, navigate]);

  const handleBanRoom = () => {
    setConfirmDialog({
      visible: true,
      title: "确认要强制关播吗？",
      content: "强制关播后，该直播间会被解散。",
      onConfirm: async () => {
        if (!roomInfo) return;
        try {
          await banRoom(roomInfo.id);
          showMessage("success", "房间已封禁");
          Message.success('该直播间已被强制关播');
          setConfirmDialog(null);
          navigate(-1);
        } catch (error: any) {
          const { code, info } = getErrorInfo(error);
          const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
          showMessage("error", `封禁失败: ${msg}`);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 禁言观众（API 接口）
  const handleMuteAudience = (userId: string, userName: string, isMuted: boolean) => {
    if (!roomId) return;
    // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行禁言
    if (userId === `${anchorUserId}_obs`) return;
    if (isMuted) {
      setConfirmDialog({
        visible: true,
        title: "确定要解除该用户禁言？",
        content: `确认解除「${userName}」的禁言吗？`,
        onConfirm: async () => {
          try {
            await unmuteMember(roomId, [userId]);
            showMessage("success", `已解除「${userName}」的禁言`);
            fetchMutedList(); // 刷新禁言列表
          } catch (error: any) {
            const { code, info } = getErrorInfo(error);
            const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
            showMessage("error", `操作失败: ${msg}`);
          } finally {
            setConfirmDialog(null);
          }
        },
      });
    } else {
      setConfirmDialog({
        visible: true,
        title: "确定要禁言该用户？",
        content: `禁言后该用户将在 10 分钟内无法发送弹幕消息，确认禁言「${userName}」吗？`,
        onConfirm: async () => {
          try {
            await muteMember(roomId, [userId], 600);
            showMessage("success", `已禁言「${userName}」`);
            fetchMutedList(); // 刷新禁言列表
          } catch (error: any) {
            const { code, info } = getErrorInfo(error);
            const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
            showMessage("error", `禁言失败: ${msg}`);
          } finally {
            setConfirmDialog(null);
          }
        },
      });
    }
  };

  // 封禁/解除封禁观众（API 接口）
  const handleBanAudience = (userId: string, userName: string, isBanned: boolean) => {
    if (!roomId) return;
    // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行封禁
    if (userId === `${anchorUserId}_obs`) return;
    if (isBanned) {
      setConfirmDialog({
        visible: true,
        title: "解除封禁",
        content: `确认取消「${userName}」的封禁吗？`,
        onConfirm: async () => {
          try {
            await unbanMember(roomId, [userId]);
            showMessage("success", `已取消「${userName}」的封禁`);
            fetchBannedList(); // 刷新封禁列表
          } catch (error: any) {
            const { code, info } = getErrorInfo(error);
            const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
            showMessage("error", `操作失败: ${msg}`);
          } finally {
            setConfirmDialog(null);
          }
        },
      });
    } else {
      setConfirmDialog({
        visible: true,
        title: "确认要封禁该用户？",
        content: `封禁后该用户将在 1 小时内无法进入房间，确认封禁「${userName}」吗？`,
        onConfirm: async () => {
          try {
            await banMember(roomId, [userId], 3600, "管理员封禁");
            showMessage("success", `已封禁「${userName}」`);
            fetchBannedList(); // 刷新封禁列表
          } catch (error: any) {
            const { code, info } = getErrorInfo(error);
            const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
            showMessage("error", `封禁失败: ${msg}`);
          } finally {
            setConfirmDialog(null);
          }
        },
      });
    }
  };

  // 加载禁言列表
  const fetchMutedList = async () => {
    if (!roomId) return;
    setMemberListLoading(true);
    try {
      const res = await getMutedMemberList(roomId);
      const mutedAccountList = res.Response?.MutedAccountList || res.MutedAccountList || [];
      const list = mutedAccountList.map((m: any) => ({
        userId: m.Member_Account,
        endTime: m.MutedUntil || 0,
      }));
      setMutedList(list);

      // 批量获取用户资料
      const userIds = list.map(item => item.userId).filter(Boolean);
      if (userIds.length > 0) {
        try {
          const profileMap = await batchGetUserProfilePortrait(userIds);
          setUserProfileCache(prev => new Map([...prev, ...profileMap]));
        } catch {
          // 获取禁言用户资料失败，静默忽略
        }
      }
    } catch (error: any) {
      console.error("获取禁言列表失败:", error);
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
      showMessage("error", `获取禁言列表失败: ${msg}`);
    } finally {
      setMemberListLoading(false);
    }
  };

  // 加载封禁列表
  const fetchBannedList = async () => {
    if (!roomId) return;
    setMemberListLoading(true);
    try {
      const res = await getBannedMemberList(roomId);
      const bannedAccountList = res.Response?.BannedAccountList || res.BannedAccountList || [];
      const list = bannedAccountList.map((m: any) => ({
        userId: m.Member_Account,
        endTime: m.BannedUntil || 0,
      }));
      setBannedList(list);

      // 批量获取用户资料
      const userIds = list.map(item => item.userId).filter(Boolean);
      if (userIds.length > 0) {
        try {
          const profileMap = await batchGetUserProfilePortrait(userIds);
          setUserProfileCache(prev => new Map([...prev, ...profileMap]));
        } catch {
          // 获取封禁用户资料失败，静默忽略
        }
      }
    } catch (error: any) {
      console.error("获取封禁列表失败:", error);
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
      showMessage("error", `获取封禁列表失败: ${msg}`);
    } finally {
      setMemberListLoading(false);
    }
  };

  // 解除禁言（列表中）
  const handleUnmuteFromList = (userId: string) => {
    if (!roomId) return;
    setConfirmDialog({
      visible: true,
      title: "解除禁言",
      content: `确认取消「${userId}」的禁言吗？`,
      onConfirm: async () => {
        try {
          await unmuteMember(roomId, [userId]);
          showMessage("success", `已取消「${userId}」的禁言`);
          fetchMutedList();
        } catch (error: any) {
          const { code, info } = getErrorInfo(error);
          const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
          showMessage("error", `操作失败: ${msg}`);
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  // 解除封禁（列表中）
  const handleUnbanFromList = (userId: string) => {
    if (!roomId) return;
    setConfirmDialog({
      visible: true,
      title: "解除封禁",
      content: `确认解除「${userId}」的封禁吗？`,
      onConfirm: async () => {
        try {
          await unbanMember(roomId, [userId]);
          showMessage("success", `已解除「${userId}」的封禁`);
          fetchBannedList();
        } catch (error: any) {
          const { code, info } = getErrorInfo(error);
          const msg = code ? getErrorMessage(code, info) : (error.message || "未知错误");
          showMessage("error", `操作失败: ${msg}`);
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  // 判断用户是否被禁言
  const isUserMuted = useCallback((userId: string): boolean => {
    return mutedList.some((m) => m.userId === userId);
  }, [mutedList]);

  // 打开观众操作下拉菜单
  const handleOpenAudienceDropdown = (
    e: React.MouseEvent,
    userId: string,
    userName: string,
    isMuted: boolean
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAudienceDropdown({
      visible: true,
      userId,
      userName,
      isMuted,
      x: rect.right,
      y: rect.bottom + 4,
    });
  };

  // 关闭下拉菜单
  const closeAudienceDropdown = useCallback(() => {
    setAudienceDropdown(null);
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!audienceDropdown?.visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeAudienceDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [audienceDropdown?.visible, closeAudienceDropdown]);

  // 进入观众列表tab时自动拉取禁言列表和封禁列表（用于标记已禁言/已封禁用户）
  useEffect(() => {
    if (activeTab === "audience" && roomId) {
      fetchMutedList();
      fetchBannedList();
    }
  }, [activeTab, roomId]);

  // 为 SDK 观众列表中的用户名添加 title 属性（实现原生 tooltip）
  useEffect(() => {
    if (activeTab !== "audience") return;

    const addTitles = () => {
      const nameElements = document.querySelectorAll('.uikit-liveAudienceList__name');
      nameElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.textContent || '';
        if (htmlEl.title !== text) {
          htmlEl.title = text;
        }
      });
    };

    // 初始添加
    addTitles();

    // 使用 MutationObserver 监听列表变化（新观众加入、列表滚动加载等）
    const container = document.querySelector('.audience-list-area');
    if (!container) return;

    const observer = new MutationObserver(addTitles);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [activeTab]);

  // 获取房间基础信息（只调用一次）
  const fetchRoomInfo = async () => {
    if (!roomId) return;
    try {
      const roomResponse = await getRoomDetail(roomId);

      if (roomResponse.ErrorCode === 0 && roomResponse.Response?.RoomInfo) {
        const item = roomResponse.Response.RoomInfo;
        const anchorName = resolveAnchorDisplayName(item, item.Owner_Account || "-");
        const anchorAvatar = resolveAnchorAvatarUrl(item);

        // 通过 API 获取主播头像
        const ownerAccount = item.Owner_Account;
        if (ownerAccount) {
          batchGetUserProfilePortrait([ownerAccount])
            .then(profileMap => {
              const profile = profileMap.get(ownerAccount);
              if (profile && isComponentMounted.current) {
                setAnchorProfile({
                  nick: profile.nick || '',
                  avatarUrl: profile.avatarUrl || '',
                });
              }
            })
            .catch(() => { /* 获取主播资料失败，静默忽略 */ });
        }

        setRoomInfo({
          id: item.RoomId,
          title: item.RoomName || "未命名房间",
          coverUrl: item.CoverURL || defaultCoverUrl,
          anchor: {
            id: item.Owner_Account,
            name: anchorName,
            avatar: anchorAvatar,
          },
          onlineCount: 0,
          createdAt: item.CreateTime * 1000,
          isMessageDisabled: item.IsMessageDisabled === true,
          roomType: item.RoomType || "Live",
          isSeatEnabled: item.IsSeatEnabled || false,
          takeSeatMode: item.TakeSeatMode || "FreeToTake",
          maxSeatCount: item.MaxSeatCount || 9,
          maxMemberCount: item.MaxMemberCount || 1000,
          category: item.Tags || [],
          activityStatus: item.ActivityStatus || 1,
          isPublicVisible:
            item.IsPublicVisibled !== undefined ? item.IsPublicVisibled : true,
          notice: item.Notice || "",
          isLikeEnabled:
            item.IsThumbsEnabled !== undefined ? item.IsThumbsEnabled : true,
        });



        const roomCreateTime = item.CreateTime ? item.CreateTime * 1000 : null;
        setCreateTime(roomCreateTime);
        if (roomCreateTime) {
          const currentDuration = Math.floor(
            (Date.now() - roomCreateTime) / 1000
          );
          setLiveDuration(currentDuration > 0 ? currentDuration : 0);
        }
      } else if (roomResponse.ErrorCode !== 0) {
        // 只有当房间确实不存在时才显示直播已结束（错误码 100004）
        // 其他错误码只显示错误信息，但仍然允许进入直播间
        if (roomResponse.ErrorCode === 100004) {
          isRoomValidRef.current = false;
          setLiveEndedOverlayVisible(true);
        }
        showMessage(
          "error",
          getErrorMessage(roomResponse.ErrorCode, roomResponse.ErrorInfo, "获取房间信息失败")
        );
      }
    } catch (error: any) {
      const { code, info } = getErrorInfo(error);
      const msg = code ? getErrorMessage(code, info) : (error.message || "网络错误");
      showMessage("error", `请求失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据（定时刷新，含收礼统计）
  const fetchStats = async () => {
    if (!roomId) return;
    try {
      const statsResponse = await getRoomStatistic(roomId);
      if (statsResponse.ErrorCode === 0 && statsResponse.Response) {
        const d = statsResponse.Response;
        setStats((prev) => ({
          ...prev,
          totalViewers: d.TotalViewers || 0,
          totalMsgCount: d.TotalMsgCount || 0,
          totalLikesReceived: d.TotalLikesReceived || 0,
          totalGiftsSent: d.TotalGiftsSent || 0,
          totalGiftCoins: d.TotalGiftCoins || 0,
          totalUniqueGiftSenders: d.TotalUniqueGiftSenders || 0,
        }));
      }
    } catch (error: any) {
      console.error("获取统计数据失败:", error.message);
    }
  };

  // 监听 SDK 就绪状态（roomEngine 实例存在即可；TUILogin 由 MainLayout 在 init 后调用 login 设置）
  // URL 覆盖模式下需要在此处初始化 SDK
  useEffect(() => {
    const initOverrideSDK = async () => {
      if (isUrlOverrideMode() && !roomEngine.instance) {
        // 从 localStorage 读取凭证（MainLayout 已调用 login API 获取并保存）
        const storedUserId = localStorage.getItem('user_id');
        const storedUserSig = localStorage.getItem('user_sig');
        const storedSdkAppId = localStorage.getItem('sdk_app_id');

        if (storedUserId && storedUserSig && storedSdkAppId) {
          console.log('[RoomControl] URL override mode, initializing SDK with userId:', storedUserId);

          try {
            init({
              baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api',
              account: {
                sdkAppId: Number(storedSdkAppId),
                userId: storedUserId,
                password: storedUserSig,
              },
            });

            await tuikitLogin({
              SDKAppID: Number(storedSdkAppId),
              userID: storedUserId,
              userSig: storedUserSig,
            });
            console.log('[RoomControl] TUILogin success, userId:', storedUserId);
          } catch (err: any) {
            if (err?.code === 2025 || err?.message?.includes('重复登录')) {
              console.log('[RoomControl] Already logged in');
            } else {
              console.error('[RoomControl] SDK init error:', err);
              return;
            }
          }
        } else {
          console.warn('[RoomControl] URL override mode but no credentials in localStorage');
        }
      }
      setSdkReady(Boolean(roomEngine.instance));
    };

    initOverrideSDK();
  }, []); // 空依赖确保挂载时执行

  useEffect(() => {
    // 当 roomEngine.instance 变化时更新状态
    setSdkReady(Boolean(roomEngine.instance));
  }, [roomEngine]);

  useEffect(() => {
    setLiveEndedOverlayVisible(false);
  }, [roomId]);

  useEffect(() => {
    isComponentMounted.current = true;
    isRoomValidRef.current = true;
    let isEffectCancelled = false;

    if (roomId && sdkReady) {
      // 先获取房间信息，成功后再加入直播间
      fetchRoomInfo().then(() => {
        if (isEffectCancelled || !isRoomValidRef.current) return;

        // 加入直播间（防止 Strict Mode 下重复 join 导致画面丢失）
        if (!hasJoinedLiveRef.current) {
          hasJoinedLiveRef.current = true;
          joinLive({ liveId: roomId }).catch((err: any) => {
            const errorCode = err?.errorCode || err?.code;
            const errorInfo = err?.ErrorInfo || err?.errorInfo || "";
            if (errorCode) {
              setLiveEndedOverlayVisible(true);
              showMessage("error", getErrorMessage(errorCode, errorInfo));
            } else {
              console.error('[RoomControl] joinLive failed:', err);
            }
            // joinLive 失败时重置标记，允许重试
            if (!isEffectCancelled) {
              hasJoinedLiveRef.current = false;
            }
          });
        }
      });

      // 统计数据立即获取一次
      fetchStats();
      // 加载禁言列表和封禁列表（用于标记已禁言/已封禁用户）
      fetchMutedList();
      fetchBannedList();

      durationTimerRef.current = window.setInterval(() => {
        setCreateTime((prev) => {
          if (prev) {
            const currentDuration = Math.floor((Date.now() - prev) / 1000);
            setLiveDuration(currentDuration > 0 ? currentDuration : 0);
          }
          return prev;
        });
      }, 1000);

      return () => {
        isEffectCancelled = true;
        isComponentMounted.current = false;

        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }

        // 仅在组件真正卸载时退出房间
        // 使用 setTimeout 0 延迟，让 Strict Mode 下的重新挂载有机会取消退房
        const joinedAtCleanup = hasJoinedLiveRef.current;
        setTimeout(() => {
          // 如果组件已经被重新挂载（Strict Mode），则不要退房
          if (!isComponentMounted.current && joinedAtCleanup) {
            hasJoinedLiveRef.current = false;
            leaveLive().catch((err) => {
              console.error('退出房间失败:', err);
            });
          }
        }, 0);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, sdkReady]);

  // Setup event listeners
  useEffect(() => {
    subscribeEvent(LiveListEvent.ON_LIVE_ENDED, handleLiveEnded);

    return () => {
      unsubscribeEvent(LiveListEvent.ON_LIVE_ENDED, handleLiveEnded);
    };
  }, [handleLiveEnded, subscribeEvent, unsubscribeEvent]);

  // 前端 SDK 数据响应式合并到 stats
  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      onlineCount: audienceCount,
      totalLikesReceived: totalLikeCount,
    }));
  }, [audienceCount, totalLikeCount]);

  // 定时刷新统计数据（收礼统计通过后端 get_gift_count 接口获取）
  useEffect(() => {
    if (!roomId || !sdkReady || refreshInterval === 0) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    refreshTimerRef.current = window.setInterval(() => {
      if (isComponentMounted.current) {
        fetchStats();
      }
    }, refreshInterval * 1000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [roomId, sdkReady, refreshInterval]);

  // 优先使用 API 获取的主播资料，然后尝试 SDK 数据，最后使用房间信息
  const roomAnchorName =
    anchorProfile?.nick ||
    resolveAnchorDisplayName(
      currentLive?.liveOwner,
      roomInfo?.anchor.name || "未知主播"
    );
  const roomAnchorAvatar =
    anchorProfile?.avatarUrl ||
    resolveAnchorAvatarUrl(currentLive?.liveOwner) ||
    roomInfo?.anchor.avatar;

  const anchorEntryUrl = useMemo(() => {
    const rid = roomId || roomInfo?.id;
    if (!rid || !anchorUserId) return "";
    return buildAnchorLiveEntryUrl(rid, anchorUserId);
  }, [roomId, roomInfo?.id, anchorUserId]);

  const handleCopyAnchorEntry = async () => {
    if (!anchorEntryUrl) return;
    try {
      await copyText(anchorEntryUrl);
      Message.success("主播入口链接已复制");
    } catch (e: unknown) {
      Message.error(e instanceof Error ? e.message : "复制失败");
    }
  };

  // 判断是否为语音房间（roomId 以 voice_ 开头）- 必须在 early return 之前声明
  const isVoiceRoom = useMemo(() => roomId?.startsWith("voice_") || false, [roomId]);

  if (loading) {
    return (
      <div className="loading-container">
        <Loading loading={true} text="正在载入监控台..." />
      </div>
    );
  }

  return (
    <div className="room-control-container">
      {/* 消息提示 */}
      <div className="toast-area">
        {successMsg && <div className="status-success">{successMsg}</div>}
        {errorMsg && <div className="status-error">{errorMsg}</div>}
      </div>

      {/* 顶栏 */}
      <header className="room-control-navbar">
        <div className="nav-left">
          <Button shape="square" variant="text" className="back-btn" onClick={handleLeaveLive} title="返回列表">
            <ArrowLeft strokeWidth={1.5} />
          </Button>
          <div className="divider"></div>
          <h1>直播间详情</h1>
        </div>
        <div className="nav-right">
          <Button variant="text" theme="danger" onClick={handleBanRoom} icon={<StopCircleIcon />}>
            强制关播
          </Button>
        </div>
      </header>

      {/* 主视图 */}
      <main className="room-control-viewport">
        {/* 左侧监控区 */}
        <section className="video-monitor-area">
          {/* 房间信息头部 */}
          <div className="room-header-external">
            <AnchorAvatar
              className="anchor-avatar"
              src={roomAnchorAvatar}
              name={roomAnchorName}
              title={roomAnchorName}
            />
            <span className="room-title-text">
              {liveEndedOverlayVisible ? '直播已结束' : currentLive?.liveName || roomInfo?.title || "正在加载..."}
            </span>
          </div>

          {anchorEntryUrl && (
            <div className="anchor-entry-banner">
              <div className="anchor-entry-banner__text">
                <span className="anchor-entry-banner__label">主播入口（占位页）</span>
                <code className="anchor-entry-banner__url" title={anchorEntryUrl}>
                  {anchorEntryUrl}
                </code>
              </div>
              <Button size="small" variant="outline" onClick={() => void handleCopyAnchorEntry()}>
                复制链接
              </Button>
            </div>
          )}

          <div className="video-stage">
            {/* 虚化背景层 */}
            {roomInfo?.coverUrl ? (
              <div
                className="video-blur-bg"
                style={{
                  backgroundImage: `url(${roomInfo.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ) : (
              <div className="video-blur-bg-placeholder" />
            )}
            {/* 播放器容器 */}
            <div className={`player-container${isVoiceRoom ? " player-container-voice" : ""}`} style={{ position: "relative" }}>
              <LiveView />
              {liveEndedOverlayVisible && (
                <div className="live-state-overlay live-state-overlay--ended">
                  <div className="live-state-overlay-content">
                    <div className="live-state-overlay-title">直播已结束</div>
                    <Button
                      shape="round"
                      variant="outline"
                      className="live-state-overlay-btn"
                      onClick={handleLeaveLive}
                    >
                      返回直播列表
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 右侧边栏 */}
        <aside className="right-sidebar">
          {/* 互动面板 (Chat/Audience) */}
          <div className="sidebar-interaction-card">
            <Tabs
              value={activeTab}
              onChange={(val) =>
                setActiveTab(val as "chat" | "audience" | "moderation" | "robot")
              }
              className="interaction-tabs"
            >
              <Tabs.TabPanel value="chat" label="消息列表" />
              <Tabs.TabPanel value="audience" label="观众列表" />
              <Tabs.TabPanel value="moderation" label="评论审核" />
              <Tabs.TabPanel value="robot" label="机器人" />
            </Tabs>
            <div className="interaction-body">
              <div
                className="chat-stream-sidebar"
                style={{
                  height: "100%",
                  display: activeTab === "chat" ? "flex" : "none",
                  flexDirection: "column",
                }}
              >
                <MessageList
                  mutedList={mutedList}
                  bannedList={bannedList}
                  onMuteUser={(userId, userName, isMuted) => handleMuteAudience(userId, userName, isMuted)}
                  onBanUser={(userId, userName, isBanned) => handleBanAudience(userId, userName, isBanned)}
                />
              </div>

              <div className="audience-tab-wrapper" style={{ display: activeTab === "audience" ? "flex" : "none" }}>
                <div className="audience-list-area">
                  <LiveAudienceList height="99%">
                    {({ audience }) =>
                      audience.userId === loginUserInfo?.userId ? (
                        <span className="audience-me-tag">我</span>
                      ) : audience.userRole !== 0 && audience.userId !== `${anchorUserId}_obs` ? (
                        <div className="audience-row-actions">
                          {isUserMuted(audience.userId) && (
                            <span className="audience-muted-badge">已禁言</span>
                          )}
                          <button
                            className="audience-more-btn"
                            title="更多操作"
                            onClick={(e) => {
                              handleOpenAudienceDropdown(
                                e,
                                audience.userId,
                                audience.userName || audience.userId,
                                isUserMuted(audience.userId)
                              );
                            }}
                          >
                            <MoreIcon size={18} />
                          </button>
                        </div>
                      ) : null
                    }
                  </LiveAudienceList>
                </div>
                {/* 底部操作按钮 */}
                <div className="audience-bottom-actions">
                  <button
                    className="audience-bottom-btn"
                    onClick={() => { fetchMutedList(); setMutedModalVisible(true); }}
                  >
                    已禁言观众 ({mutedList.length})
                  </button>
                  <button
                    className="audience-bottom-btn"
                    onClick={() => { fetchBannedList(); setBannedModalVisible(true); }}
                  >
                    已封禁观众 ({bannedList.length})
                  </button>
                </div>
              </div>

              <div
                className="moderation-tab-wrapper"
                style={{
                  display: activeTab === "moderation" ? "flex" : "none",
                  flexDirection: "column",
                  height: "100%",
                  minHeight: 0,
                  padding: "8px 0",
                }}
              >
                {roomId ? <ModerationQueuePanel roomId={roomId} /> : null}
              </div>

              <div
                className="robot-tab-wrapper"
                style={{
                  display: activeTab === "robot" ? "flex" : "none",
                  flexDirection: "column",
                  height: "100%",
                  minHeight: 0,
                  padding: "8px 0",
                }}
              >
                {roomId ? <RobotRulesPanel roomId={roomId} /> : null}
              </div>
            </div>
          </div>

          {/* 直播数据中控 */}
          <div className="sidebar-stats-card">
            <div className="stats-card-header">
              <h3>直播数据中控</h3>
              <div className="refresh-control-inline">
                <span className="refresh-label">自动刷新:</span>
                <select
                  className="refresh-select"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                >
                  {refreshOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="stats-grid-design">
              <div className="stat-item">
                <div className="stat-label">
                  直播时长 <Tooltip content="自直播间创建至当前的实时累计时长"><Info size={14} className="info-icon" /></Tooltip>
                </div>
                <div className={`stat-value ${liveDuration >= 86400 ? 'stat-value-small' : ''}`}>
                  {formatDuration(liveDuration)}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">
                  实时在线人数 <Tooltip content="实时在线的观众人数"><Info size={14} className="info-icon" /></Tooltip>
                </div>
                <div className="stat-value">
                  {formatNumber(stats.onlineCount)}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">
                  总评论数 <Tooltip content="直播间累计收到的评论总数"><Info size={14} className="info-icon" /></Tooltip>
                </div>
                <div className="stat-value">
                  {stats.totalMsgCount.toLocaleString()}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">
                  打赏总金额 <Tooltip content="直播期间所有用户赠送礼物的累计金额"><Info size={14} className="info-icon" /></Tooltip>
                </div>
                <div className="stat-value">{stats.totalGiftCoins.toFixed(2)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">
                  打赏次数 <Tooltip content="直播期间礼物赠送的总次数"><Info size={14} className="info-icon" /></Tooltip>
                </div>
                <div className="stat-value">{stats.totalGiftsSent}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">
                  打赏人数 <Tooltip content="直播期间赠送过礼物的独立用户数"><Info size={14} className="info-icon" /></Tooltip>
                </div>
                <div className="stat-value">{stats.totalUniqueGiftSenders}</div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* 观众操作下拉菜单 */}
      {audienceDropdown?.visible && (
        <div
          ref={dropdownRef}
          className="user-action-dropdown"
          style={{
            position: "fixed",
            top: audienceDropdown.y,
            left: audienceDropdown.x - 160,
          }}
        >
          <div className="dropdown-header">
            {audienceDropdown.userName}
          </div>
          <div className="dropdown-divider" />
          {audienceDropdown.isMuted ? (
            <button
              className="dropdown-item"
              onClick={() => {
                handleMuteAudience(
                  audienceDropdown.userId,
                  audienceDropdown.userName,
                  true
                );
                closeAudienceDropdown();
              }}
            >
              <CheckCircleIcon size={14} />
              解除禁言
            </button>
          ) : (
            <button
              className="dropdown-item"
              onClick={() => {
                handleMuteAudience(
                  audienceDropdown.userId,
                  audienceDropdown.userName,
                  false
                );
                closeAudienceDropdown();
              }}
            >
              <ChatOffIcon size={14} />
              禁言
            </button>
          )}
          <button
            className="dropdown-item danger"
            onClick={() => {
              handleBanAudience(
                audienceDropdown.userId,
                audienceDropdown.userName,
                false
              );
              closeAudienceDropdown();
            }}
          >
            <UserBlockedIcon size={14} />
            封禁
          </button>
        </div>
      )}

      {/* 已禁言观众弹框 */}
      <Dialog
        visible={mutedModalVisible}
        header="已禁言观众"
        onClose={() => setMutedModalVisible(false)}
        width={DIALOG_WIDTH.WIDE}
        footer={
          <Button shape="round" variant="outline" onClick={() => setMutedModalVisible(false)}>
            关闭
          </Button>
        }
      >
        <div className="member-list-panel-modal">
          {memberListLoading ? (
            <div className="member-list-empty">加载中...</div>
          ) : mutedList.length === 0 ? (
            <div className="member-list-empty">暂无禁言成员</div>
          ) : (
            <table className="member-list-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>禁言解除时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {mutedList.map((item) => {
                  const userName = getUserNameFromCache(item.userId);
                  return (
                    <tr key={item.userId}>
                      <td className="member-table-user">
                        <div className="member-table-user-cell">
                          <AnchorAvatar
                            className="member-table-avatar"
                            src={getUserAvatar(item.userId)}
                            name={userName}
                          />
                          <Tooltip content={userName} placement="top" showArrow={false}>
                            <span className="member-table-user-name">{userName}</span>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="member-table-time">
                        {item.endTime > 0 ? new Date(item.endTime * 1000).toLocaleString() : '-'}
                      </td>
                      <td className="member-table-action">
                        <button
                          className="member-table-text-btn"
                          onClick={() => handleUnmuteFromList(item.userId)}
                        >
                          解除禁言
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Dialog>

      {/* 确认弹窗 - zIndex 需高于封禁/禁言列表弹窗，解决 Safari 下层叠顺序问题 */}
      <Dialog
        visible={confirmDialog?.visible || false}
        header={confirmDialog?.title || ''}
        onClose={() => setConfirmDialog(null)}
        width={DIALOG_WIDTH.CONFIRM}
        zIndex={2600}
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => setConfirmDialog(null)}>
              取消
            </Button>
            <Button shape="round" theme="primary" onClick={confirmDialog?.onConfirm}>
              确认
            </Button>
          </>
        }
      >
        <p>{confirmDialog?.content}</p>
      </Dialog>

      {/* 已封禁观众弹框 */}
      <Dialog
        visible={bannedModalVisible}
        header="已封禁观众"
        onClose={() => setBannedModalVisible(false)}
        width={DIALOG_WIDTH.WIDE}
        footer={
          <Button shape="round" variant="outline" onClick={() => setBannedModalVisible(false)}>
            关闭
          </Button>
        }
      >
        <div className="member-list-panel-modal">
          {memberListLoading ? (
            <div className="member-list-empty">加载中...</div>
          ) : bannedList.length === 0 ? (
            <div className="member-list-empty">暂无封禁成员</div>
          ) : (
            <table className="member-list-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>封禁解除时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {bannedList.map((item) => {
                  const userName = getUserNameFromCache(item.userId);
                  return (
                    <tr key={item.userId}>
                      <td className="member-table-user">
                        <div className="member-table-user-cell">
                          <AnchorAvatar
                            className="member-table-avatar"
                            src={getUserAvatar(item.userId)}
                            name={userName}
                          />
                          <Tooltip content={userName} placement="top" showArrow={false}>
                            <span className="member-table-user-name">{userName}</span>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="member-table-time">
                        {item.endTime > 0 ? new Date(item.endTime * 1000).toLocaleString() : '-'}
                      </td>
                      <td className="member-table-action">
                        <button
                          className="member-table-text-btn"
                          onClick={() => handleUnbanFromList(item.userId)}
                        >
                          解除封禁
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Dialog>



    </div>
  );
}
