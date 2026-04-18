import React, { useEffect, useState } from 'react';
import { getFallbackInitial, resolveAnchorAvatarUrl, resolveAnchorDisplayName, defaultAvatarUrl } from '@live-manager/common';

// 从共享包重新导出，保持现有引用不变
export { resolveAnchorAvatarUrl, resolveAnchorDisplayName };

interface AnchorAvatarProps {
  className?: string;
  name?: string;
  src?: string;
  title?: string;
}

export default function AnchorAvatar({
  className = 'anchor-avatar',
  name,
  src,
  title,
}: AnchorAvatarProps) {
  const [currentSrc, setCurrentSrc] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || defaultAvatarUrl);
    setShowTextFallback(false);
  }, [src]);

  const altText = name ? `${name}头像` : '主播头像';

  if (!currentSrc || showTextFallback) {
    return (
      <div className={className} title={title} aria-label={altText}>
        {getFallbackInitial(name)}
      </div>
    );
  }

  return (
    <div className={className} title={title} aria-label={altText}>
      <img
        src={currentSrc}
        alt={altText}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'block',
          objectFit: 'cover',
          borderRadius: 'inherit',
        }}
        onError={() => {
          if (currentSrc !== defaultAvatarUrl) {
            setCurrentSrc(defaultAvatarUrl);
            return;
          }
          setShowTextFallback(true);
        }}
      />
    </div>
  );
}
