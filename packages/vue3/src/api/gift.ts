/**
 * 礼物 API - 从共享包重新导出
 */
import './client';

export {
  getGiftList,
  getGift,
  createGift,
  updateGift,
  deleteGift,
  toggleGiftEnabled,
  getGiftCategoryList,
  createGiftCategory,
  deleteGiftCategory,
  updateGiftCategory,
  getGiftCategory,
  getGiftLanguage,
  setGiftLanguage,
  delGiftLanguage,
  getGiftCategoryLanguage,
  setGiftCategoryLanguage,
  delGiftCategoryLanguage,
  addGiftCategoryRelations,
  delGiftCategoryRelations,
} from '@live-manager/common';
