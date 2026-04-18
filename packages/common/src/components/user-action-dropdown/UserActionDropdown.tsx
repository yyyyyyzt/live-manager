import React, { useEffect, useRef } from 'react';
import { ChatOffIcon, UserBlockedIcon, CheckCircleIcon, UserCheckedIcon } from 'tdesign-icons-react';

export interface UserActionDropdownProps {
  visible: boolean;
  userId: string;
  userName?: string;
  muted?: boolean;
  banned?: boolean;
  showMute?: boolean;
  showBan?: boolean;
  position?: { top: number; left: number };
  onVisibleChange?: (visible: boolean) => void;
  onMute?: (userId: string, userName: string, isMuted: boolean) => void;
  onBan?: (userId: string, userName: string, isBanned: boolean) => void;
}

const UserActionDropdown: React.FC<UserActionDropdownProps> = ({
  visible,
  userId,
  userName = '',
  muted = false,
  banned = false,
  showMute = true,
  showBan = true,
  position = { top: 0, left: 0 },
  onVisibleChange,
  onMute,
  onBan,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      onVisibleChange?.(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onVisibleChange]);

  if (!visible) return null;

  const handleMute = () => {
    onMute?.(userId, userName, muted);
    onVisibleChange?.(false);
  };

  const handleBan = () => {
    onBan?.(userId, userName, banned);
    onVisibleChange?.(false);
  };

  return (
    <div
      ref={dropdownRef}
      className="user-action-dropdown"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1100,
      }}
    >
      {userName && (
        <>
          <div className="dropdown-header">{userName}</div>
          <div className="dropdown-divider" />
        </>
      )}
      {showMute && (
        <button className="dropdown-item" onClick={handleMute}>
          {muted ? <CheckCircleIcon size={14} /> : <ChatOffIcon size={14} />}
          <span>{muted ? '解除禁言' : '禁言'}</span>
        </button>
      )}
      {showBan && (
        <button
          className={`dropdown-item ${!banned ? 'danger' : ''}`}
          onClick={handleBan}
        >
          {banned ? <UserCheckedIcon size={14} /> : <UserBlockedIcon size={14} />}
          <span>{banned ? '解除封禁' : '封禁'}</span>
        </button>
      )}
    </div>
  );
};

export default UserActionDropdown;
