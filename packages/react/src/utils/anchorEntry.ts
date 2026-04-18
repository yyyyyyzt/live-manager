/**
 * 管理员下发给主播的占位开播页链接（Hash 路由，与后台一致）。
 * @see packages/react/src/views/AnchorLivePlaceholder.tsx
 */
export function buildAnchorLiveEntryUrl(roomId: string, anchorUserId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = '/#/anchor/live';
  const q = new URLSearchParams();
  if (roomId) q.set('roomId', roomId);
  if (anchorUserId) q.set('anchorUserId', anchorUserId);
  const qs = q.toString();
  return `${origin}${path}${qs ? `?${qs}` : ''}`;
}
