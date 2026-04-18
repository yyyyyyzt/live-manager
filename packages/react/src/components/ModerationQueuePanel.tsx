import { useCallback, useEffect, useState } from 'react';
import { Button, Loading } from 'tdesign-react';
import {
  getModerationPending,
  approveModerationComment,
  rejectModerationComment,
} from '../api/moderation';
import type { ModerationPendingItem } from '../api/moderation';
import { Message } from './Toast';

interface Props {
  roomId: string;
}

export default function ModerationQueuePanel({ roomId }: Props) {
  const [list, setList] = useState<ModerationPendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const res = await getModerationPending(roomId);
      if (res.code === 0 && res.data?.list) {
        setList(res.data.list);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      Message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!roomId) return;
    const t = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(t);
  }, [roomId, load]);

  const onApprove = async (id: string) => {
    setActingId(id);
    try {
      const res = await approveModerationComment(roomId, id);
      if (res.code === 0) {
        Message.success('已通过');
        await load();
      }
    } catch (e: unknown) {
      Message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setActingId(null);
    }
  };

  const onReject = async (id: string) => {
    setActingId(id);
    try {
      const res = await rejectModerationComment(roomId, id);
      if (res.code === 0) {
        Message.success('已拒绝');
        await load();
      }
    } catch (e: unknown) {
      Message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setActingId(null);
    }
  };

  if (!roomId) {
    return <div style={{ padding: 12, color: '#999' }}>无房间 ID</div>;
  }

  return (
    <div className="moderation-queue-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#666' }}>待审（内存队列，重启清空）</span>
        <Button size="small" variant="outline" onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
      </div>
      {loading && list.length === 0 ? (
        <Loading style={{ margin: '24px auto' }} />
      ) : list.length === 0 ? (
        <div style={{ color: '#999', fontSize: 13, padding: 16 }}>暂无待审评论</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'auto', flex: 1 }}>
          {list.map((item) => (
            <li
              key={item.id}
              style={{
                borderBottom: '1px solid #eee',
                padding: '10px 0',
                fontSize: 13,
              }}
            >
              <div style={{ color: '#888', marginBottom: 4 }}>
                {item.senderId} · {new Date(item.createdAt).toLocaleString()}
              </div>
              <div style={{ marginBottom: 8, wordBreak: 'break-word' }}>{item.text}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  theme="primary"
                  loading={actingId === item.id}
                  disabled={!!actingId && actingId !== item.id}
                  onClick={() => void onApprove(item.id)}
                >
                  通过
                </Button>
                <Button
                  size="small"
                  theme="danger"
                  variant="outline"
                  loading={actingId === item.id}
                  disabled={!!actingId && actingId !== item.id}
                  onClick={() => void onReject(item.id)}
                >
                  拒绝
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
