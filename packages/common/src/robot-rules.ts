import { get, put } from './client';

export interface KeywordReplyRule {
  keyword: string;
  reply: string;
  match?: 'contains' | 'exact';
}

export interface RobotRulesPayload {
  enabled?: boolean;
  keywordReplies?: KeywordReplyRule[];
}

export interface RobotRulesApiOk<T> {
  code: number;
  message?: string;
  data?: T;
}

export async function getRobotRules(roomId: string): Promise<RobotRulesApiOk<{ rules: RobotRulesPayload }>> {
  return get('/robot/rules', { roomId }) as Promise<RobotRulesApiOk<{ rules: RobotRulesPayload }>>;
}

export async function putRobotRules(
  roomId: string,
  body: RobotRulesPayload
): Promise<RobotRulesApiOk<{ rules: RobotRulesPayload }>> {
  const q = `?roomId=${encodeURIComponent(roomId)}`;
  return put(`/robot/rules${q}`, body) as Promise<RobotRulesApiOk<{ rules: RobotRulesPayload }>>;
}
