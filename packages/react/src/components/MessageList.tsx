import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BarrageList, useLoginState, useLiveListState, useLiveAudienceState } from 'tuikit-atomicx-react';
import {
  ChatOffIcon,
  UserBlockedIcon,
  CheckCircleIcon,
  UserCheckedIcon,
} from 'tdesign-icons-react';
import type { Barrage, MessageListProps } from '@live-manager/common';
import { parseTextWithEmoji } from '@live-manager/common';
import '@live-manager/common/style/message-list.css';
import '@live-manager/common/components/user-action-dropdown/user-action-dropdown.css';

// 下拉菜单位置类型
interface DropdownPosition {
  top: number;
  left: number;
}

// ============================================================
// CustomMessage 组件 - 提取到外部，保持引用稳定
// 这是解决闪烁的关键：如果定义在 MessageList 内部，
// 每次父组件重渲染都会创建新的组件引用，导致 BarrageList
// 认为 Message prop 变了，从而卸载/重建所有消息 DOM，图片重新请求。
// ============================================================

// 通过 ref 传递 context 给外部组件，避免闭包捕获导致重新创建
interface MessageContextRef {
  anchorUserId?: string;
  onMessageClick?: (event: React.MouseEvent, message: Barrage) => void;
}

const messageContextRef: { current: MessageContextRef } = { current: {} };

const CustomMessage = React.memo<{ message: Barrage; style?: React.CSSProperties }>(
  ({ message, style }) => {
    const senderId = message.sender.userId;
    const isAnchor = senderId === messageContextRef.current.anchorUserId;
    const displayName = message.sender.nameCard || message.sender.userName || senderId;

    // 根据消息类型获取显示内容
    const displayText = message.messageType === 0 ? message.textContent : message.data || '';
    const segments = parseTextWithEmoji(displayText);

    const onClickHandler = (e: React.MouseEvent) => {
      messageContextRef.current.onMessageClick?.(e, message);
    };

    return (
      <div
        className={`message-item${isAnchor ? ' host' : ''}`}
        style={style}
        onClick={onClickHandler}
      >
        {isAnchor && <span className="message-badge">主播</span>}
        <span className="message-username">{displayName}: </span>
        <span className="message-content">
          {segments.length > 0 ? (
            segments.map((segment, index) => {
              if (segment.type === 'text') {
                return <span key={`t${index}`} className="message-text">{segment.text}</span>;
              }
              return (
                <img
                  key={`e${index}-${segment.key}`}
                  src={segment.src}
                  alt={segment.key}
                  className="message-emoji"
                  loading="lazy"
                  draggable={false}
                />
              );
            })
          ) : (
            <span className="message-text">{displayText}</span>
          )}
        </span>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较：同一条消息（liveId + sequence）且 style 不变则跳过渲染
    return (
      prevProps.message.liveId === nextProps.message.liveId &&
      prevProps.message.sequence === nextProps.message.sequence &&
      prevProps.style === nextProps.style
    );
  }
);

const MessageList: React.FC<MessageListProps> = ({ onMuteUser, onBanUser, mutedList = [], bannedList = [] }) => {
  const { loginUserInfo } = useLoginState();
  const { currentLive } = useLiveListState();
  const { audienceList, disableSendMessage: sdkDisableSendMessage } = useLiveAudienceState();

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const [selectedMessage, setSelectedMessage] = useState<Barrage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 缓存主播 ID，避免每次渲染时重新获取
  const anchorUserId = useMemo(() => currentLive?.liveOwner?.userId, [currentLive?.liveOwner?.userId]);

  // 从观众列表中获取用户信息
  const getAudienceInfo = (userId: string) => {
    return audienceList?.find(item => item.userId === userId);
  };

  // 检查用户是否被禁言 (优先使用 SDK 观众列表状态)
  const isUserMuted = (userId: string): boolean => {
    const audienceInfo = getAudienceInfo(userId);
    if (audienceInfo) {
      return audienceInfo.isMessageDisabled === true;
    }
    const mutedUser = mutedList.find(m => m.userId === userId);
    if (!mutedUser) return false;
    return mutedUser.endTime > Date.now() / 1000;
  };

  // 检查用户是否被封禁
  const isUserBanned = (userId: string): boolean => {
    const bannedUser = bannedList.find(b => b.userId === userId);
    if (!bannedUser) return false;
    return bannedUser.endTime > Date.now() / 1000;
  };

  // 关闭下拉菜单
  useEffect(() => {
    if (!dropdownVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      setTimeout(() => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
          return;
        }
        setDropdownVisible(false);
        setSelectedMessage(null);
      }, 100);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownVisible]);

  // 点击消息项显示下拉菜单
  const handleMessageClick = useCallback((event: React.MouseEvent, message: Barrage) => {
    event.stopPropagation();

    console.log('[MessageList] handleMessageClick called', {
      messageSender: message.sender.userId,
      loginUserId: loginUserInfo?.userId,
      anchorUserId,
    });

    // 如果是自己发送的消息,不显示菜单
    if (message.sender.userId === loginUserInfo?.userId) {
      console.log('[MessageList] 自己的消息，不显示菜单');
      return;
    }

    // 如果是主播的消息,不显示菜单
    if (message.sender.userId === anchorUserId) {
      console.log('[MessageList] 主播的消息，不显示菜单');
      return;
    }

    // 如果是主播的 OBS 推流账号,不显示菜单
    if (message.sender.userId === `${anchorUserId}_obs`) {
      return;
    }

    const targetElement = (event.target as HTMLElement).closest('.message-item');
    if (!targetElement) {
      console.log('[MessageList] 未找到 message-item 元素');
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const top = rect.bottom + 4;
    const left = Math.min(rect.left, window.innerWidth - 160);

    console.log('[MessageList] 显示下拉菜单', { top, left });
    setDropdownPosition({ top, left: Math.max(0, left) });
    setSelectedMessage(message);
    setDropdownVisible(true);
  }, [loginUserInfo, anchorUserId]);

  // 同步 context 给外部的 CustomMessage 使用（通过 mutable ref，不触发渲染）
  useEffect(() => {
    messageContextRef.current.anchorUserId = anchorUserId;
    messageContextRef.current.onMessageClick = handleMessageClick;
  });

  // 封禁/解除封禁用户
  const handleBanClick = () => {
    if (selectedMessage && onBanUser) {
      const userId = selectedMessage.sender.userId;
      // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行封禁
      if (userId !== `${anchorUserId}_obs`) {
        const userName = selectedMessage.sender.userName || selectedMessage.sender.nameCard || selectedMessage.sender.userId;
        const userIsBanned = isUserBanned(userId);
        onBanUser(userId, userName, userIsBanned);
      }
    }
    setDropdownVisible(false);
    setSelectedMessage(null);
  };

  // 禁言/解除禁言用户
  const handleMuteClick = async () => {
    if (!selectedMessage) return;

    const userId = selectedMessage.sender.userId;
    // 过滤 OBS 推流账号，不允许对主播的 OBS 账号进行禁言
    if (userId === `${anchorUserId}_obs`) {
      setDropdownVisible(false);
      setSelectedMessage(null);
      return;
    }

    const userName = selectedMessage.sender.userName || selectedMessage.sender.nameCard || selectedMessage.sender.userId;
    const userIsMuted = isUserMuted(userId);

    try {
      if (sdkDisableSendMessage) {
        await sdkDisableSendMessage({ userId, isDisable: !userIsMuted });
        console.log(userIsMuted ? '解除禁言成功' : '禁言成功');
      } else if (onMuteUser) {
        onMuteUser(userId, userName, userIsMuted);
      }
    } catch (error) {
      console.error('SDK 禁言失败，使用备用方法:', error);
      if (onMuteUser) {
        onMuteUser(userId, userName, userIsMuted);
      }
    }

    setDropdownVisible(false);
    setSelectedMessage(null);
  };

  return (
    <div
      className="message-list-container"
      ref={containerRef}
    >
      <BarrageList
        Message={CustomMessage}
        className="barrage-list-wrapper"
      />

      {/* 下拉菜单 - 使用 Portal 渲染到 body，避免被父容器 overflow 裁剪 */}
      {dropdownVisible && selectedMessage && createPortal(
        <div
          ref={dropdownRef}
          className="user-action-dropdown"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999,
          }}
        >
          <button className="dropdown-item" onClick={handleMuteClick}>
            {isUserMuted(selectedMessage.sender.userId) ? (
              <>
                <CheckCircleIcon size={14} />
                <span>解除禁言</span>
              </>
            ) : (
              <>
                <ChatOffIcon size={14} />
                <span>禁言</span>
              </>
            )}
          </button>
          <button className="dropdown-item danger" onClick={handleBanClick}>
            {isUserBanned(selectedMessage.sender.userId) ? (
              <>
                <UserCheckedIcon size={14} />
                <span>解除封禁</span>
              </>
            ) : (
              <>
                <UserBlockedIcon size={14} />
                <span>封禁</span>
              </>
            )}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

// 使用 memo 包装组件，避免不必要的重新渲染
export default React.memo(MessageList);
