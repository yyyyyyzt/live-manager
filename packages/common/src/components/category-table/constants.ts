/**
 * 礼物类别表格常量定义
 */

import type { LangKey, LangMap } from '../gift-table/types';

// 从 gift-table 导入语言相关常量
export { LANG_MAP, LANG_CODE_TO_KEY, LANG_CONFIG_KEYS } from '../gift-table/constants';

/**
 * 类别数量上限
 */
export const MAX_CATEGORY_COUNT = 10;

/**
 * 类别字节限制常量
 */
export const CATEGORY_ID_MAX_BYTES = 20;
export const CATEGORY_NAME_MAX_BYTES = 20;
export const CATEGORY_DESC_MAX_BYTES = 60;
