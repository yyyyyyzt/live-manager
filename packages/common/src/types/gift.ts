// 多语言详情项（礼物）
export interface GiftLanguageDetail {
  Name: string;
  Desc: string;
  Language: string;
}

// 多语言详情项（分类）
export interface CategoryLanguageDetail {
  CategoryName: string;
  CategoryDesc: string;
  Language: string;
}

// 礼物配置
export interface GiftItem {
  id: string;
  name: string;
  iconUrl: string;
  price: number;
  animationUrl?: string;
  enabled: boolean;
  description?: string;
  extensionInfo?: string;
  category?: string[];
  categories?: string[];
  categoryIds?: string[];
  languages?: string[];
  languageList?: GiftLanguageDetail[];
  level?: string;
  createdAt?: string;
}

// 创建礼物请求参数
export interface CreateGiftParams {
  id: string;
  name: string;
  iconUrl: string;
  price: number;
  animationUrl?: string;
  enabled?: boolean;
  level?: number;
  description?: string;
  extensionInfo?: string;
}

// 更新礼物请求参数
export interface UpdateGiftParams {
  name?: string;
  iconUrl?: string;
  price?: number;
  animationUrl?: string;
  level?: number;
  description?: string;
  extensionInfo?: string;
}

// 礼物列表响应
export interface GiftListResponse {
  gifts: GiftItem[];
  total: number;
  categories?: GiftCategoryItem[];
}

// 礼物分类项
export interface GiftCategoryItem {
  id: string;
  name: string;
  description?: string;
  extensionInfo?: string;
  giftIds?: string[];
  giftCount?: number;
  languageList?: CategoryLanguageDetail[];
  languages?: string;
  CategoryId?: string;
  DefaultName?: string;
  DefaultDesc?: string;
  ExtensionInfo?: string;
}

// 创建礼物分类请求参数
export interface CreateGiftCategoryParams {
  categoryId: string;
  defaultName: string;
  defaultDesc?: string;
  extensionInfo?: string;
}
