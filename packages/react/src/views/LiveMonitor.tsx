import React, { useState, useEffect, useRef } from "react";
import { useAppNavigate } from "../hooks/useAppNavigate";
import {
  CloseIcon,
  SoundIcon,
  SoundMuteIcon,
  FullscreenIcon,
  SearchIcon,
  StopCircleIcon,
  RefreshIcon,
} from 'tdesign-icons-react';
import { Input, Dialog, Button } from 'tdesign-react';
import { useLiveMonitorState, useLiveListState } from "tuikit-atomicx-react";
import { ErrorCode } from "../types";
import { getRoomDetail, getRoomList } from "../api/room";
import { getErrorMessage, ROOM_SEARCH_MAX_BYTES, getByteLength } from "@live-manager/common";
import { batchGetUserProfilePortrait } from "../api/auth";
import type { UserPortraitProfile } from "../api/auth";
import AnchorAvatar, {
  resolveAnchorAvatarUrl,
  resolveAnchorDisplayName,
} from "../components/AnchorAvatar";
import { Message } from "../components/Toast";
import { DIALOG_WIDTH, defaultCoverUrl } from "@live-manager/common";
import "@live-manager/common/style/live-monitor.css";

const LiveMonitor: React.FC = () => {
  const navigate = useAppNavigate();
  const {
    startPlay,
    stopPlay,
    closeRoom,
    muteLiveAudio,
    monitorLiveInfoList,
  } = useLiveMonitorState();
  const { leaveLive } = useLiveListState();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [fullscreenLiveId, setFullscreenLiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasRoomData, setHasRoomData] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [closeConfirm, setCloseConfirm] = useState<{
    visible: boolean;
    liveId: string;
    liveName: string;
    closing: boolean;
  }>({ visible: false, liveId: "", liveName: "", closing: false });
  const playingLiveIdsRef = useRef<Set<string>>(new Set());
  const isUnmountedRef = useRef(false);
  const queuedLoadRef = useRef<{ page?: number; version?: number } | null>(null);

  // 搜索状态
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // 输入变化时更新值（超限仅红框提示，不拦截输入）
  const handleSearchInputChange = (value: string) => {
    setSearchInput(String(value));
  };
  /** 防止并发/重复执行（如 React Strict Mode 双跑 effect）导致同一房间 startPlay 两次 */
  const loadInFlightRef = useRef(false);
  /** 追踪当前翻页请求的版本号，用于忽略过时的请求 */
  const pageVersionRef = useRef(0);

  const pageSize = 8;

  // 用户资料缓存（头像、昵称）- 批量获取后缓存
  const [userProfileMap, setUserProfileMap] = useState<Map<string, UserPortraitProfile>>(new Map());

  // 分页数据缓存（用于支持上一页功能）- 缓存每页的数据
  const pageDataCacheRef = useRef<Map<number, any[]>>(new Map());
  // 分页游标缓存
  const pageCursorsRef = useRef<Map<number, string>>(new Map([[1, '']]));

  // init 由 MainLayout 统一调用，此处不再重复 init，避免重复进房相关逻辑
  // useEffect(() => { init(...); }, [init]); 已移除

  // 🚀 后台预取下一页数据（静默请求，不影响当前页状态）
  // 使用 ref 追踪正在进行的预取 Promise，翻页时可以等待它完成而不是发新请求
  const prefetchPromiseRef = useRef<Map<number, Promise<void>>>(new Map());

  const prefetchNextPage = (nextPage: number, cursor: string) => {
    // 如果已经在预取中，不重复发起
    if (prefetchPromiseRef.current.has(nextPage)) return;

    const promise = (async () => {
      try {
        const response = await getRoomList({ next: cursor, count: pageSize, sortDirection: 'descend' });
        const roomList = response.Response?.RoomList || [];
        if (roomList.length === 0 || isUnmountedRef.current) return;

        const liveList = roomList.map((item) => ({
          liveId: item.RoomId,
          roomId: item.RoomId,
          roomName: item.RoomName || '',
          anchorId: item.Owner_Account || '',
          coverUrl: item.CoverURL || '',
          viewCount: item.ViewCount || 0,
          popularity: item.Popularity || 0,
          activityStatus: item.ActivityStatus || 0,
          createTime: item.CreateTime || 0,
        }));

        // 写入缓存
        if (!pageDataCacheRef.current.has(nextPage)) {
          pageDataCacheRef.current.set(nextPage, liveList);
        }

        // 判断并缓存 hasMore 状态
        const nextCursorFromResponse = response.Response?.Next || '';
        const hasMore = isValidNextCursor(nextCursorFromResponse, liveList.length);
        pageHasMoreRef.current.set(nextPage, hasMore);

        // 缓存再下一页的游标（仅在有更多数据时）
        if (hasMore && nextCursorFromResponse) {
          pageCursorsRef.current.set(nextPage + 1, nextCursorFromResponse);
        }

        // 预取主播头像
        const ownerAccounts = roomList
          .map((item: any) => item.Owner_Account)
          .filter((id: string | undefined): id is string => Boolean(id));
        if (ownerAccounts.length > 0) {
          const uncachedIds = ownerAccounts.filter((id: string) => !userProfileMap.has(id));
          if (uncachedIds.length > 0) {
            batchGetUserProfilePortrait(uncachedIds)
              .then(profileMap => {
                if (!isUnmountedRef.current) {
                  setUserProfileMap(prev => new Map([...prev, ...profileMap]));
                }
              })
              .catch(() => { }); // 预取失败静默忽略
          }
        }
      } catch {
        // 预取失败不影响主流程，静默忽略
      } finally {
        prefetchPromiseRef.current.delete(nextPage);
      }
    })();

    prefetchPromiseRef.current.set(nextPage, promise);
  };

  // 缓存每页对应的 hasMore 状态
  const pageHasMoreRef = useRef<Map<number, boolean>>(new Map());

  // 判断 API 返回的 Next 游标是否表示"还有更多数据"
  const isValidNextCursor = (next: string | undefined, dataLength: number): boolean => {
    // 没有游标 → 没有更多
    if (!next) return false;
    // 游标为 '0' 或空字符串 → 没有更多
    if (next === '0' || next === '') return false;
    // 返回数据量不足一页 → 没有更多
    if (dataLength < pageSize) return false;
    return true;
  };

  // 获取指定页的数据（三级策略：缓存 → 等待预取 → 新请求）
  const fetchPageData = async (pageToLoad: number) => {
    // 策略 1: 直接命中缓存
    const cachedData = pageDataCacheRef.current.get(pageToLoad);
    if (cachedData) {
      const cachedHasMore = pageHasMoreRef.current.get(pageToLoad) ?? false;
      return { liveList: cachedData, hasMore: cachedHasMore, fromNetwork: false };
    }

    // 策略 2: 有正在进行的预取，等待它完成（避免重复请求）
    const pendingPrefetch = prefetchPromiseRef.current.get(pageToLoad);
    if (pendingPrefetch) {
      await pendingPrefetch;
      const prefetchedData = pageDataCacheRef.current.get(pageToLoad);
      if (prefetchedData) {
        const cachedHasMore = pageHasMoreRef.current.get(pageToLoad) ?? false;
        return { liveList: prefetchedData, hasMore: cachedHasMore, fromNetwork: false };
      }
    }

    // 策略 3: 发起新请求
    const nextCursor = pageCursorsRef.current.get(pageToLoad) || '';
    const response = await getRoomList({ next: nextCursor, count: pageSize, sortDirection: 'descend' });
    const roomList = response.Response?.RoomList || [];

    const liveList = roomList.map((item) => ({
      liveId: item.RoomId,
      roomId: item.RoomId,
      roomName: item.RoomName || '',
      anchorId: item.Owner_Account || '',
      coverUrl: item.CoverURL || '',
      viewCount: item.ViewCount || 0,
      popularity: item.Popularity || 0,
      activityStatus: item.ActivityStatus || 0,
      createTime: item.CreateTime || 0,
    }));

    // 缓存该页数据
    pageDataCacheRef.current.set(pageToLoad, liveList);

    // 综合判断是否有更多数据：Next 游标有效 + 返回数据量满一页
    const nextCursorFromResponse = response.Response?.Next || '';
    const hasMore = isValidNextCursor(nextCursorFromResponse, liveList.length);
    pageHasMoreRef.current.set(pageToLoad, hasMore);

    // 缓存下一页的游标 + 触发预取（仅在确实有更多数据时）
    if (hasMore && nextCursorFromResponse) {
      pageCursorsRef.current.set(pageToLoad + 1, nextCursorFromResponse);
      if (!pageDataCacheRef.current.has(pageToLoad + 1)) {
        prefetchNextPage(pageToLoad + 1, nextCursorFromResponse);
      }
    }

    return { liveList, hasMore, fromNetwork: true };
  };

  // 加载并播放指定页（page 为空时用内存中的 currentPage，用于初次加载）
  const loadAndPlayNewPage = async (page?: number, version?: number) => {
    if (isUnmountedRef.current) return;

    if (loadInFlightRef.current) {
      queuedLoadRef.current = { page, version };
      return;
    }

    loadInFlightRef.current = true;
    const pageToLoad = page ?? currentPage;
    const currentVersion = version ?? pageVersionRef.current;
    setLoading(true);

    try {
      // 获取页面数据（缓存 / 预取等待 / 新请求，三级策略）
      const { liveList, hasMore } = await fetchPageData(pageToLoad);

      if (isUnmountedRef.current || pageVersionRef.current !== currentVersion) {
        return;
      }

      setCurrentPage(pageToLoad);
      setHasMoreData(hasMore);

      // 异步获取主播用户资料（不阻塞）
      const anchorIds = liveList
        .map((item: any) => item.anchorId)
        .filter((id: string | undefined): id is string => Boolean(id));
      if (anchorIds.length > 0) {
        const uncachedIds = anchorIds.filter((id: string) => !userProfileMap.has(id));
        if (uncachedIds.length > 0) {
          batchGetUserProfilePortrait(uncachedIds)
            .then(profileMap => {
              if (!isUnmountedRef.current && pageVersionRef.current === currentVersion) {
                setUserProfileMap(prev => new Map([...prev, ...profileMap]));
              }
            })
            .catch(() => { /* 批量获取用户资料失败，静默忽略 */ });
        }
      }

      // 检查版本号
      if (isUnmountedRef.current || pageVersionRef.current !== currentVersion) {
        return;
      }

      // 标记是否有数据，用于控制空状态显示
      setHasRoomData(liveList.length > 0);

      // 数据加载完成后立即结束 loading，允许用户继续翻页
      setLoading(false);

      if (isUnmountedRef.current || pageVersionRef.current !== currentVersion) {
        return;
      }

      // 记录本页所有 liveId（用于翻页时 stopPlay）
      playingLiveIdsRef.current.clear();
      liveList.forEach((item) => playingLiveIdsRef.current.add(item.liveId));

      // 分批 fire-and-forget 进房，不阻塞翻页
      // stopPlay 可以直接终止 startPlay，所以不需要 await
      const BATCH_CONCURRENCY = 4;
      for (let i = 0; i < liveList.length; i += BATCH_CONCURRENCY) {
        if (isUnmountedRef.current || pageVersionRef.current !== currentVersion) {
          break;
        }

        const batch = liveList.slice(i, i + BATCH_CONCURRENCY);
        void Promise.all(
          batch.map((item) =>
            startPlay(item.liveId, `live_monitor_view_${item.roomId}`)
              .catch((error: any) => {
                if (
                  error === ErrorCode.LOGIN_TIMEOUT ||
                  error === ErrorCode.USER_SIG_ILLEGAL
                ) {
                  localStorage.removeItem("tuiLiveMonitor-userInfo");
                  window.location.href = "/#/login";
                }
              })
          )
        );
      }
    } catch (error: any) {
      console.error("加载直播列表失败:", error);
      if (!isUnmountedRef.current) {
        setLoading(false);
      }
    } finally {
      loadInFlightRef.current = false;

      if (!isUnmountedRef.current && queuedLoadRef.current) {
        const nextLoad = queuedLoadRef.current;
        queuedLoadRef.current = null;
        void loadAndPlayNewPage(nextLoad.page, nextLoad.version);
      }
    }
  };

  // 停止所有正在播放的房间（stopPlay 可直接终止 startPlay，无需等待）
  const stopAllPlayingLives = async (version?: number) => {
    const cleanupVersion = version ?? ++pageVersionRef.current;

    const ids = Array.from(playingLiveIdsRef.current);
    playingLiveIdsRef.current.clear();

    if (ids.length > 0) {
      await Promise.all(
        ids.map((liveId) =>
          stopPlay(liveId).catch((error) => {
            console.error("停止直播预览失败:", liveId, error);
          })
        )
      );
    }

    return cleanupVersion;
  };

  const switchPage = async (page: number) => {
    if (loading) return;
    if (page < 1) return;
    // 向后翻页时：检查 hasMoreData + 确保有对应的游标或缓存
    if (page > currentPage) {
      if (!hasMoreData) return;
      if (!pageDataCacheRef.current.has(page) && !pageCursorsRef.current.has(page)) return;
    }

    // 递增版本号，让旧的 loadAndPlayNewPage 中的版本检查自行中止
    const newVersion = ++pageVersionRef.current;

    // 直接 stopPlay 所有旧页房间（不需要等 startPlay 完成）+ 并行加载新页
    void stopAllPlayingLives(newVersion);
    await loadAndPlayNewPage(page, newVersion);
  };

  const handleCloseLive = (liveId: string, liveName: string) => {
    setCloseConfirm({ visible: true, liveId, liveName, closing: false });
  };

  const handleConfirmClose = async () => {
    const { liveId } = closeConfirm;
    if (!liveId) return;
    setCloseConfirm(prev => ({ ...prev, closing: true }));
    try {
      await stopPlay(liveId);
      playingLiveIdsRef.current.delete(liveId);
      await closeRoom(liveId);
      setCloseConfirm({ visible: false, liveId: "", liveName: "", closing: false });
      Message.success('该直播间已被强制关播');

      // 如果当前页是最后一页且只剩最后一个直播间，关播后跳转到上一页
      const isLastPage = !hasMoreData;
      const currentPageData = pageDataCacheRef.current.get(currentPage);
      const currentItemCount = currentPageData?.length ?? monitorLiveInfoList.length;
      if (isLastPage && currentItemCount <= 1 && currentPage > 1) {
        // 清除当前页缓存，跳转上一页
        pageDataCacheRef.current.delete(currentPage);
        pageHasMoreRef.current.delete(currentPage);
        const newVersion = ++pageVersionRef.current;
        void stopAllPlayingLives(newVersion);
        await loadAndPlayNewPage(currentPage - 1, newVersion);
      } else {
        // 正常刷新当前页
        // 清除当前页及后续页缓存，确保数据最新
        for (const key of pageDataCacheRef.current.keys()) {
          if (key >= currentPage) {
            pageDataCacheRef.current.delete(key);
            pageHasMoreRef.current.delete(key);
          }
        }
        const newVersion = ++pageVersionRef.current;
        void stopAllPlayingLives(newVersion);
        await loadAndPlayNewPage(currentPage, newVersion);
      }
    } catch (error) {
      console.error("强制关播失败:", error);
      setCloseConfirm(prev => ({ ...prev, closing: false }));
    }
  };

  const handleCancelClose = () => {
    setCloseConfirm({ visible: false, liveId: "", liveName: "", closing: false });
  };

  const handleClickDetails = (liveId: string) => {
    // 保存分页状态到 sessionStorage，以便返回时恢复
    try {
      sessionStorage.setItem('liveMonitor_currentPage', String(currentPage));
      sessionStorage.setItem('liveMonitor_pageCursors', JSON.stringify(Array.from(pageCursorsRef.current.entries())));
      sessionStorage.setItem('liveMonitor_pageHasMore', JSON.stringify(Array.from(pageHasMoreRef.current.entries())));
    } catch { /* sessionStorage 不可用时静默忽略 */ }
    navigate(`/room-control/${liveId}`);
  };

  const toggleMuteAudio = async (liveId: string) => {
    const newMutedState = !isMuted;
    await muteLiveAudio(liveId, newMutedState);
    setIsMuted(newMutedState);
  };

  // 搜索房间
  const handleSearch = async (keyword?: string) => {
    const input = (keyword ?? searchInput).trim();
    if (!input) {
      return;
    }
    if (getByteLength(keyword ?? searchInput) > ROOM_SEARCH_MAX_BYTES) {
      Message.error('输入内容太长');
      return;
    }

    const roomId = input;

    setSearching(true);
    const searchVersion = await stopAllPlayingLives();

    try {
      const response = await getRoomDetail(roomId);

      if (isUnmountedRef.current || pageVersionRef.current !== searchVersion) {
        return;
      }

      if (response.ErrorCode !== 0) {
        Message.error(getErrorMessage(response.ErrorCode, response.ErrorInfo, `没有搜到「${input}」`));
        await loadAndPlayNewPage(1, searchVersion);
        return;
      }

      const roomInfo = response.Response?.RoomInfo;
      if (roomInfo) {
        setIsSearchMode(true);

        const liveId = roomInfo.RoomId;
        const anchorId = roomInfo.Owner_Account || '';

        // 获取主播用户资料
        if (anchorId) {
          try {
            const profileMap = await batchGetUserProfilePortrait([anchorId]);
            if (!isUnmountedRef.current && pageVersionRef.current === searchVersion) {
              setUserProfileMap(prev => new Map([...prev, ...profileMap]));
            }
          } catch {
            // 获取主播资料失败，静默忽略
          }
        }

        playingLiveIdsRef.current.add(liveId);

        try {
          await startPlay(liveId, `live_monitor_view_${liveId}`);
        } catch {
          // startPlay 失败不影响搜索流程
        }

        if (
          isUnmountedRef.current ||
          pageVersionRef.current !== searchVersion
        ) {
          await stopPlay(liveId);
          return;
        }

        Message.success('搜索成功');
      } else {
        Message.error(`没有搜到「${input}」`);
        await loadAndPlayNewPage(1, searchVersion);
      }
    } catch (error: any) {
      console.error('搜索直播间失败:', error);

      if (
        error === ErrorCode.LOGIN_TIMEOUT ||
        error === ErrorCode.USER_SIG_ILLEGAL
      ) {
        localStorage.removeItem('tuiLiveMonitor-userInfo');
        window.location.href = '/#/login';
        return;
      }

      Message.error(`没有搜到「${input}」`);
      await loadAndPlayNewPage(1, searchVersion);
    } finally {
      if (!isUnmountedRef.current) {
        setSearching(false);
      }
    }
  };

  // 清空搜索（清空输入并刷新恢复完整列表）
  const handleClearSearch = async () => {
    console.log('[LiveMonitor] handleClearSearch called, isSearchMode:', isSearchMode);
    setSearchInput('');
    setIsSearchMode(false);
    pageDataCacheRef.current.clear();
    pageHasMoreRef.current.clear();
    pageCursorsRef.current = new Map([[1, '']]);
    const resetVersion = await stopAllPlayingLives();
    console.log('[LiveMonitor] after stopAllPlayingLives, resetVersion:', resetVersion);
    await loadAndPlayNewPage(1, resetVersion);
    console.log('[LiveMonitor] after loadAndPlayNewPage');
  };

  // 刷新当前页面数据
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      // 清空搜索模式
      if (isSearchMode) {
        setIsSearchMode(false);
        setSearchInput('');
      }
      // 清空所有缓存，强制重新获取
      pageDataCacheRef.current.clear();
      pageHasMoreRef.current.clear();
      prefetchPromiseRef.current.clear();
      pageCursorsRef.current = new Map([[1, '']]);
      const resetVersion = await stopAllPlayingLives();
      await loadAndPlayNewPage(1, resetVersion);
      Message.success('刷新成功');
    } catch (error: any) {
      console.error('刷新失败:', error);
      const errorInfo = error?.ErrorInfo || error?.errorInfo || "";
      Message.error(`刷新失败${errorInfo ? ` (${errorInfo})` : ""}`);
    } finally {
      if (!isUnmountedRef.current) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = async () => {
      if (document.fullscreenElement) {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
        if (!isMuted && fullscreenLiveId) {
          await muteLiveAudio(fullscreenLiveId, true);
          setIsMuted(true);
          setFullscreenLiveId("");
        }
      }
    };

    addEventListener("fullscreenchange", onFullscreenChange);
    return () => removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isMuted, fullscreenLiveId]);

  useEffect(() => {
    isUnmountedRef.current = false;

    // 从 sessionStorage 恢复分页状态
    let pageToLoad = 1;
    try {
      const savedPage = sessionStorage.getItem('liveMonitor_currentPage');
      const savedCursors = sessionStorage.getItem('liveMonitor_pageCursors');
      const savedHasMore = sessionStorage.getItem('liveMonitor_pageHasMore');

      // 清除已读取的状态（一次性恢复）
      sessionStorage.removeItem('liveMonitor_currentPage');
      sessionStorage.removeItem('liveMonitor_pageCursors');
      sessionStorage.removeItem('liveMonitor_pageHasMore');

      if (savedPage && savedCursors) {
        const page = Number(savedPage);
        if (page > 0) {
          const cursors: [number, string][] = JSON.parse(savedCursors);
          pageCursorsRef.current = new Map(cursors);
          if (savedHasMore) {
            const hasMoreEntries: [number, boolean][] = JSON.parse(savedHasMore);
            pageHasMoreRef.current = new Map(hasMoreEntries);
          }
          pageToLoad = page;
        }
      }
    } catch { /* 解析失败时回退到第1页 */ }

    void loadAndPlayNewPage(pageToLoad);

    // 组件卸载时清理所有 TRTC 连接并退出房间
    return () => {
      isUnmountedRef.current = true;
      const cleanupVersion = ++pageVersionRef.current;

      void stopAllPlayingLives(cleanupVersion);

      // 退出当前房间（防止房间残留）
      void leaveLive().catch((err) => {
        console.error('退出房间失败:', err);
      });
    };
  }, []);

  // 追踪上一次处理的 liveId 列表，避免重复处理
  const lastProcessedLiveIdsRef = useRef<string>("");

  // 监听 monitorLiveInfoList 变化，批量获取主播用户资料
  useEffect(() => {
    if (monitorLiveInfoList.length === 0) return;

    // 生成当前列表的 liveId 标识
    const currentLiveIds = monitorLiveInfoList.map(item => item.liveId).join(",");

    // 如果列表内容和上次完全相同，跳过处理
    if (lastProcessedLiveIdsRef.current === currentLiveIds) {
      return;
    }
    lastProcessedLiveIdsRef.current = currentLiveIds;

    // 提取所有主播ID
    const anchorIds = monitorLiveInfoList
      .map(item => {
        const itemAny = item as any;
        const liveOwner = itemAny.liveOwner;
        const liveOwnerStr = typeof liveOwner === 'string' ? liveOwner : undefined;
        return (
          liveOwnerStr ||
          itemAny.liveOwner?.userId ||
          itemAny.liveOwner?.userName ||
          itemAny.anchorId ||
          itemAny.roomOwner ||
          itemAny.ownerId ||
          itemAny.Owner_Account ||
          itemAny.ownerAccount ||
          ''
        );
      })
      .filter((id): id is string => Boolean(id));

    if (anchorIds.length === 0) return;

    // 过滤掉已缓存的用户
    const uncachedIds = anchorIds.filter(id => !userProfileMap.has(id));

    if (uncachedIds.length === 0) return;

    // 批量获取用户资料
    batchGetUserProfilePortrait(uncachedIds)
      .then(profileMap => {
        if (!isUnmountedRef.current) {
          setUserProfileMap(prev => new Map([...prev, ...profileMap]));
        }
      })
      .catch(() => { /* 批量获取用户资料失败，静默忽略 */ });
  }, [monitorLiveInfoList]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="live-monitor-page">
      <div className="monitor-header">
        <div className="monitor-title-section">
          <h2 className="monitor-title">直播监控</h2>
        </div>
        <div className="monitor-header-actions">
          {/* 搜索框 */}
          <Input
            value={searchInput}
            onChange={handleSearchInputChange}
            onEnter={() => {
              if (getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES) {
                Message.error('输入内容太长');
                return;
              }
              handleSearch();
            }}
            clearable
            onClear={handleClearSearch}
            placeholder="输入房间 ID 搜索"
            suffixIcon={<SearchIcon size={16} />}
            className="monitor-search-input"
            status={getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES ? 'error' : 'default'}
            tips={getByteLength(searchInput) > ROOM_SEARCH_MAX_BYTES ? '输入内容超出长度限制' : ''}
          />
          {/* 刷新按钮 */}
          <Button
            theme="primary"
            variant="outline"
            shape="round"
            icon={<RefreshIcon />}
            loading={refreshing}
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </div>
      </div>

      <div className="live-monitor-grid">
        {loading ? (
          <div className="monitor-loading">
            <div className="loading-spinner" />
            <span>加载中...</span>
          </div>
        ) : !hasRoomData ? (
          <div className="monitor-empty">
            <div className="empty-icon">
              <FullscreenIcon size={48} />
            </div>
            <p>暂无直播间</p>
          </div>
        ) : (
          monitorLiveInfoList.map((item) => {
            // 从批量获取的用户资料中获取头像和昵称
            // 尝试多种字段名获取主播 ID
            const itemAny = item as any;
            // liveOwner 可能是字符串（直接是用户ID）或对象（包含 userId/userName）
            const liveOwner = itemAny.liveOwner;
            const liveOwnerStr = typeof liveOwner === 'string' ? liveOwner : undefined;
            const anchorId =
              liveOwnerStr ||
              itemAny.liveOwner?.userId ||
              itemAny.liveOwner?.userName ||
              itemAny.anchorId ||
              itemAny.roomOwner ||
              itemAny.ownerId ||
              itemAny.Owner_Account ||
              itemAny.ownerAccount ||
              '';

            const userProfile = anchorId ? userProfileMap.get(anchorId) : undefined;

            // 头像优先级：批量获取的用户资料 > item.avatarUrl > 通用解析兜底
            const directAvatar =
              typeof (item as { avatarUrl?: unknown }).avatarUrl === "string"
                ? (item as { avatarUrl?: string }).avatarUrl?.trim() || ""
                : "";
            const anchorAvatar = userProfile?.avatarUrl || directAvatar || resolveAnchorAvatarUrl(item);

            // 昵称优先级：批量获取的用户资料 > 通用解析
            const anchorName = userProfile?.nick || resolveAnchorDisplayName(item, "未知主播");

            return (
              <div
                key={item.liveId}
                className={`live-card ${hoveredCardId === item.liveId ? "hovered" : ""
                  }`}
                onMouseEnter={() => setHoveredCardId(item.liveId)}
                onMouseLeave={() => {
                  setHoveredCardId(null);
                }}
              >
                <div id={item.liveId} className="live-video-container">
                  <div
                    className="live-video-bg"
                    style={{
                      backgroundImage: `url(${item.backgroundUrl || item.coverUrl || defaultCoverUrl
                        })`,
                    }}
                  />
                  <div
                    id={`live_monitor_view_${item.liveId}`}
                    className="live-video-player"
                  />

                  <div className="live-id-badge">
                    <span title={item.liveId}>房间ID: {item.liveId}</span>
                  </div>

                  <div
                    className="live-video-overlay"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClickDetails(item.liveId);
                    }}
                  >
                    <div className="overlay-btn primary">
                      <FullscreenIcon size={16} />
                      查看详情
                    </div>
                  </div>

                  {isFullscreen && (
                    <>
                      <button
                        className="fullscreen-close"
                        onClick={() => document.exitFullscreen()}
                      >
                        <CloseIcon size={20} />
                      </button>
                      <button
                        className="fullscreen-mute"
                        onClick={() => toggleMuteAudio(item.liveId)}
                      >
                        {isMuted ? <SoundMuteIcon size={18} /> : <SoundIcon size={18} />}
                      </button>
                    </>
                  )}
                </div>

                <div className="live-card-info">
                  <div className="live-card-title" title={item.liveName || "未命名直播间"}>
                    {item.liveName || "未命名直播间"}
                  </div>
                  <div className="live-card-meta">
                    <div className="live-card-anchor">
                      <AnchorAvatar
                        className="anchor-avatar"
                        src={anchorAvatar}
                        name={anchorName}
                        title={anchorName}
                      />
                      <span className="anchor-name" title={anchorName}>{anchorName}</span>
                    </div>
                    <span className="meta-viewer-count" title={String((item as any).currentViewerCount || 0)}>
                      {(item as any).currentViewerCount || 0}次观看
                    </span>
                  </div>
                </div>

                <div
                  className={`live-card-actions ${hoveredCardId === item.liveId ? "show" : ""
                    }`}
                >
                  <Button
                    className="action-btn close full"
                    variant="text"
                    icon={<StopCircleIcon size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseLive(item.liveId, item.liveName || "未命名直播间");
                    }}
                  >
                    <span className="button-text">强制关播</span>
                  </Button>
                </div>
              </div>
            );
          })
        )}

      </div>

      <div className="live-monitor-pagination">
        <Button
          variant="outline"
          size="small"
          disabled={currentPage <= 1 || loading}
          onClick={() => switchPage(1)}
        >
          首页
        </Button>
        <Button
          variant="outline"
          size="small"
          disabled={currentPage <= 1 || loading}
          onClick={() => switchPage(currentPage - 1)}
        >
          上一页
        </Button>
        <span className="page-info">第 {currentPage} 页</span>
        <Button
          variant="outline"
          size="small"
          disabled={!hasMoreData || loading}
          onClick={() => switchPage(currentPage + 1)}
        >
          下一页
        </Button>
      </div>

      {/* 强制关播确认弹窗 */}
      <Dialog
        visible={closeConfirm.visible}
        header="确认要强制关播吗？"
        onClose={handleCancelClose}
        width={DIALOG_WIDTH.CONFIRM}
        footer={
          <>
            <Button shape="round" variant="outline" onClick={handleCancelClose} disabled={closeConfirm.closing}>
              取消
            </Button>
            <Button
              shape="round"
              theme="primary"
              onClick={handleConfirmClose}
              disabled={closeConfirm.closing}
            >
              {closeConfirm.closing ? "关播中..." : "确认"}
            </Button>
          </>
        }
      >
        <p>强制关播后，该直播间会被解散。</p>
      </Dialog>
    </div>
  );
};

export default LiveMonitor;
