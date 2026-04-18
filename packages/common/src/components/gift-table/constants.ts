/**
 * 礼物表格常量定义
 */

import type { LangKey, LangMap } from './types';

/**
 * 语言映射配置
 */
export const LANG_MAP: LangMap = {
  sc: { code: 'zh-Hans', label: '简体中文' },
  tc: { code: 'zh-Hant', label: '繁体中文' },
  en: { code: 'en', label: '英语' },
};

/**
 * API语言代码到内部key的反向映射
 */
export const LANG_CODE_TO_KEY: Record<string, LangKey> = {
  'zh-Hans': 'sc',
  'zh-Hant': 'tc',
  'en': 'en',
};

/**
 * 多语言配置弹窗中显示的语言列表
 */
export const LANG_CONFIG_KEYS: LangKey[] = ['sc', 'tc', 'en'];

/**
 * 字节限制常量
 */
export const GIFT_ID_MAX_BYTES = 20;
export const GIFT_NAME_MAX_BYTES = 20;
export const GIFT_DESC_MAX_BYTES = 20;
export const GIFT_EXT_MAX_BYTES = 100;
export const GIFT_SEARCH_MAX_BYTES = 20;
export const ROOM_SEARCH_MAX_BYTES = 45;
