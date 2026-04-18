import { useSearchParams } from 'react-router-dom';

/**
 * 主播开播页占位：与管理员后台同仓，后续接入开播 demo。
 * 期望 query：roomId、anchorUserId（由管理员下发链接携带）。
 */
export default function AnchorLivePlaceholder() {
  const [params] = useSearchParams();
  const roomId = params.get('roomId') || '';
  const anchorUserId = params.get('anchorUserId') || '';

  return (
    <div style={{ padding: 48, maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>主播开播</h1>
      <p style={{ color: '#666', lineHeight: 1.6, marginBottom: 24 }}>
        此页面为占位，开播能力尚未接入。请使用管理员下发的房间与账号信息；后续将在此完成浏览器开播或 OBS 指引。
      </p>
      <div
        style={{
          background: '#f5f5f5',
          borderRadius: 8,
          padding: 16,
          fontSize: 14,
          wordBreak: 'break-all',
        }}
      >
        <div>
          <strong>roomId：</strong>
          {roomId || '（未携带）'}
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>anchorUserId：</strong>
          {anchorUserId || '（未携带）'}
        </div>
      </div>
    </div>
  );
}
