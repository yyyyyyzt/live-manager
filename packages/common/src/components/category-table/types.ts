/**
 * 礼物类别表格组件类型定义
 */

import type { LangKey, LangEditForm, GiftLangConfig } from '../gift-table/types';

// 重新导出语言相关类型
export type { LangKey, LangEditForm, GiftLangConfig };

/**
 * 类别语言详情
 */
export interface CategoryLanguageDetail {
  CategoryName: string;
  CategoryDesc: string;
  Language: string;
}

/**
 * 类别数据项
 */
export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  languageList: CategoryLanguageDetail[];
  giftCount: number;
}

/**
 * 类别语言配置（复用 GiftLangConfig 结构）
 */
export type CategoryLangConfig = GiftLangConfig;
