/**
 * 礼物表格组件类型定义
 */

/**
 * 语言类型
 */
export type LangKey = 'sc' | 'tc' | 'en';

/**
 * 语言映射
 */
export interface LangInfo {
  code: string;
  label: string;
}

export type LangMap = Record<LangKey, LangInfo>;

/**
 * 表格列定义
 */
export interface GiftTableColumn {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

/**
 * 礼物数据项
 */
export interface GiftItem {
  id: string;
  name: string;
  iconUrl?: string;
  animationUrl?: string;
  price: number;
  level?: number | string;
  description?: string;
  categories?: string[];
  languageList?: any[];
  extensionInfo?: string;
  enabled?: boolean;
  createdAt?: number | string;
}

/**
 * 表格 Props
 */
export interface GiftTableProps<T = GiftItem> {
  columns: GiftTableColumn[];
  data: T[];
  rowKey: string;
  loading?: boolean;
  emptyText?: string;
}

/**
 * 语言编辑表单
 */
export interface LangEditForm {
  name: string;
  description: string;
}

/**
 * 礼物语言配置
 */
export interface GiftLangConfig {
  sc: LangEditForm;
  tc: LangEditForm;
  en: LangEditForm;
}
