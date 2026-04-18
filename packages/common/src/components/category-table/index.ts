/**
 * 礼物类别表格组件公共资源
 * 
 * 提供跨框架共享的类型定义、常量和工具函数
 */

// 类型定义
export type {
  LangKey,
  LangEditForm,
  GiftLangConfig,
  CategoryLanguageDetail,
  CategoryItem,
  CategoryLangConfig,
} from './types';

// 常量
export {
  LANG_MAP,
  LANG_CODE_TO_KEY,
  LANG_CONFIG_KEYS,
  MAX_CATEGORY_COUNT,
  CATEGORY_ID_MAX_BYTES,
  CATEGORY_NAME_MAX_BYTES,
  CATEGORY_DESC_MAX_BYTES,
} from './constants';

// 工具函数
export {
  getByteLength,
  getLangKeyByCode,
  getLangLabel,
  getLangCode,
  convertGiftCategoriesToCategoryItems,
} from './utils';
