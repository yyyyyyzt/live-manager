/**
 * 礼物表格工具函数
 */

import type { LangKey, LangInfo } from './types';
import { LANG_MAP } from './constants';

/**
 * 计算字符串的 UTF-8 字节长度
 */
export function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * 按 UTF-8 字节长度截断字符串
 */
export function truncateToMaxBytes(str: string, maxBytes: number): string {
  if (!str || maxBytes <= 0) {
    return '';
  }

  let result = '';
  let currentBytes = 0;

  for (const char of str) {
    const charBytes = getByteLength(char);
    if (currentBytes + charBytes > maxBytes) {
      break;
    }
    result += char;
    currentBytes += charBytes;
  }

  return result;
}

/**
 * 格式化时间戳
 */
export function formatTime(timestamp: number | string | undefined): string {
  if (!timestamp) return '-';
  
  // Unix 秒数转换为毫秒
  const ts = typeof timestamp === 'number' ? timestamp * 1000 : parseInt(timestamp) * 1000;
  const date = new Date(ts);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取语言信息
 */
export function getLangInfo(langKey: LangKey): LangInfo | undefined {
  return LANG_MAP[langKey];
}

/**
 * 根据语言代码获取语言key
 */
export function getLangKeyByCode(langCode: string): LangKey | undefined {
  const entry = Object.entries(LANG_MAP).find(([_, info]) => info.code === langCode);
  return entry ? (entry[0] as LangKey) : undefined;
}

/**
 * 获取语言标签
 */
export function getLangLabel(langCode: string): string {
  const langKey = getLangKeyByCode(langCode);
  return langKey ? LANG_MAP[langKey].label : langCode;
}

/**
 * 从语言列表中提取语言代码
 */
export function getLangCode(lang: any): string {
  return typeof lang === 'string' ? lang : lang.Language;
}
