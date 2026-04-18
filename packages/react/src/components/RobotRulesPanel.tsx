import { useCallback, useEffect, useState } from 'react';
import { Button, Switch, Textarea, Loading } from 'tdesign-react';
import { getRobotRules, putRobotRules } from '../api/robot-rules';
import type { RobotRulesPayload } from '../api/robot-rules';
import { Message } from './Toast';

interface Props {
  roomId: string;
}

export default function RobotRulesPanel({ roomId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jsonText, setJsonText] = useState('{}');
  const [enabled, setEnabled] = useState(false);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const res = await getRobotRules(roomId);
      if (res.code === 0 && res.data?.rules) {
        const r = res.data.rules as RobotRulesPayload;
        setEnabled(!!r.enabled);
        setJsonText(JSON.stringify(r, null, 2));
      }
    } catch (e: unknown) {
      Message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    let parsed: RobotRulesPayload;
    try {
      parsed = JSON.parse(jsonText) as RobotRulesPayload;
    } catch {
      Message.error('JSON 格式无效');
      return;
    }
    parsed.enabled = enabled;
    setSaving(true);
    try {
      const res = await putRobotRules(roomId, parsed);
      if (res.code === 0) {
        Message.success('已保存（当前为服务端内存，后续可迁 Metadata）');
        if (res.data?.rules) {
          setJsonText(JSON.stringify(res.data.rules, null, 2));
        }
      }
    } catch (e: unknown) {
      Message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!roomId) {
    return <div style={{ padding: 12, color: '#999' }}>无房间 ID</div>;
  }

  if (loading) {
    return <Loading style={{ margin: '24px auto' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, minHeight: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Switch checked={enabled} onChange={(v) => setEnabled(v)} label={['机器人关', '机器人开']} />
        <span style={{ color: '#666' }}>Worker 未接入时仅保存规则</span>
      </div>
      <Textarea
        value={jsonText}
        onChange={(v) => setJsonText(String(v))}
        autosize={{ minRows: 8, maxRows: 16 }}
        placeholder='{"keywordReplies":[{"keyword":"你好","reply":"您好","match":"contains"}]}'
      />
      <Button theme="primary" loading={saving} onClick={() => void save()}>
        保存规则
      </Button>
    </div>
  );
}
