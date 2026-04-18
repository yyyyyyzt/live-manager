/**
 * 礼物类别表格工具函数
 */

import type { CategoryItem, CategoryLanguageDetail } from './types';
import { getByteLength as baseGetByteLength } from '../gift-table/utils';

// 重新导出工具函数
export { getByteLength, getLangKeyByCode, getLangLabel, getLangCode } from '../gift-table/utils';

/**
 * 转换 GiftCategory[] 到 CategoryItem[]
 */
export function convertGiftCategoriesToCategoryItems(giftCategories: any[]): CategoryItem[] {
  return giftCategories.map((category: any) => ({
    id: category.id || category.CategoryId || category.categoryId,
    name: category.name || category.CategoryName || category.defaultName || '未命名分类',
    description: category.description || category.CategoryDesc || category.defaultDesc || '',
    languageList: category.languageList || [],
    giftCount: category.giftIds?.length || category.GiftIdList?.length || 0,
  }));
}
