import { trtcRequest, TRTCApi } from './trtc-client';
import type { GiftItem, CreateGiftParams, UpdateGiftParams, GiftListResponse, GiftCategoryItem, CreateGiftCategoryParams } from './types';

// 生成礼物ID
const generateGiftId = () => {
  return 'gift_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// 字段映射：TRTC API → 前端 GiftItem
const mapTRTCGiftToFrontend = (gift: any, giftToCategories: Map<string, string[]>, giftToCategoryIds: Map<string, string[]>): GiftItem => ({
  id: gift.GiftId,
  name: gift.Name,
  iconUrl: gift.IconUrl,
  price: gift.Coins,
  animationUrl: gift.ResourceUrl || '',
  enabled: true,
  level: gift.Level ? String(gift.Level) : undefined,
  description: gift.Desc,
  extensionInfo: gift.ExtensionInfo,
  languageList: gift.LanguageList || [],
  categories: giftToCategories.get(gift.GiftId) || [],
  categoryIds: giftToCategoryIds.get(gift.GiftId) || [],
  createdAt: gift.CreateTime,
});

// 获取礼物列表
export async function getGiftList(language?: string): Promise<GiftListResponse> {
  const response = await trtcRequest(TRTCApi.getGiftList, {
    Language: language || 'zh',
  });

  if (response && response.ErrorCode === 0 && response.Response) {
    const giftList = response.Response.GiftList || [];
    const categoryList = response.Response.CategoryList || [];

    const mappedCategories: GiftCategoryItem[] = categoryList.map((cat: any) => ({
      id: cat.CategoryId,
      name: cat.CategoryName,
      description: cat.CategoryDesc || '',
      extensionInfo: cat.CategoryExtension,
      giftIds: cat.GiftIdList || [],
      giftCount: (cat.GiftIdList || []).length,
      languageList: cat.LanguageList || [],
    }));

    const giftToCategories = new Map<string, string[]>();
    const giftToCategoryIds = new Map<string, string[]>();
    mappedCategories.forEach(cat => {
      (cat.giftIds || []).forEach((giftId: string) => {
        if (!giftToCategories.has(giftId)) {
          giftToCategories.set(giftId, []);
          giftToCategoryIds.set(giftId, []);
        }
        giftToCategories.get(giftId)!.push(cat.name);
        giftToCategoryIds.get(giftId)!.push(cat.id);
      });
    });

    const mappedGifts = giftList.map((gift: any) => mapTRTCGiftToFrontend(gift, giftToCategories, giftToCategoryIds));

    // 按创建时间倒序排列（最新创建的在前）
    mappedGifts.sort((a: GiftItem, b: GiftItem) => {
      const timeA = Number(a.createdAt) || 0;
      const timeB = Number(b.createdAt) || 0;
      return timeB - timeA;
    });

    return {
      gifts: mappedGifts,
      total: mappedGifts.length,
      categories: mappedCategories,
    };
  }

  throw new Error(`TRTC API error: ${response?.ErrorInfo || 'Unknown error'}`);
}

// 获取单个礼物信息
export async function getGift(giftId: string): Promise<GiftItem> {
  const response = await trtcRequest(TRTCApi.getGift, {
    GiftId: giftId,
  });

  if (response && (response.ErrorCode === 0 || response.ActionStatus === 'OK')) {
    const giftInfo = response.GiftInfo || response;
    return {
      id: giftInfo.GiftId,
      name: giftInfo.DefaultName || giftInfo.Name,
      iconUrl: giftInfo.IconUrl,
      price: giftInfo.Coins,
      animationUrl: giftInfo.ResourceUrl || '',
      enabled: true,
      level: giftInfo.Level ? `Lv${giftInfo.Level}` : undefined,
      description: giftInfo.DefaultDesc || giftInfo.Desc,
      extensionInfo: giftInfo.ExtensionInfo,
      languageList: giftInfo.LanguageList || [],
      categories: [],
      categoryIds: [],
      createdAt: giftInfo.CreateTime,
    };
  }

  throw new Error(response?.ErrorInfo || 'TRTC API failed');
}

// 创建礼物
export async function createGift(params: CreateGiftParams): Promise<any> {
  const response = await trtcRequest(TRTCApi.addGift, {
    GiftId: params.id,
    IconUrl: params.iconUrl,
    ResourceUrl: params.animationUrl || '',
    Coins: params.price,
    Level: params.level || 0,
    ExtensionInfo: params.extensionInfo || '',
    DefaultName: params.name,
    DefaultDesc: params.description || '',
  });

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    return { code: 0, message: 'success', data: { giftId: response.Response?.GiftId } };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

// 更新礼物
export async function updateGift(giftId: string, params: UpdateGiftParams): Promise<any> {
  const data: any = { GiftId: giftId };
  if (params.iconUrl !== undefined) data.IconUrl = params.iconUrl;
  if (params.animationUrl !== undefined) data.ResourceUrl = params.animationUrl;
  if (params.price !== undefined) data.Coins = params.price;
  if (params.level !== undefined) data.Level = params.level;
  if (params.extensionInfo !== undefined) data.ExtensionInfo = params.extensionInfo;
  if (params.name !== undefined) data.DefaultName = params.name;
  if (params.description !== undefined) data.DefaultDesc = params.description;

  const response = await trtcRequest(TRTCApi.editGift, data);

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    return { code: 0, message: 'success' };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

// 删除礼物
export async function deleteGift(giftId: string): Promise<void> {
  const response = await trtcRequest(TRTCApi.delGift, { GiftId: giftId });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}

// 切换礼物启用状态
export async function toggleGiftEnabled(giftId: string, enabled: boolean): Promise<void> {
  await trtcRequest(TRTCApi.editGift, {
    GiftId: giftId,
    ExtensionInfo: JSON.stringify({ enabled }),
  });
}

// ========== 礼物分类管理 ==========

export async function getGiftCategoryList(): Promise<{ categories: GiftCategoryItem[]; total: number }> {
  const response = await trtcRequest(TRTCApi.getGiftList, { Language: 'zh' });

  if (response && response.ErrorCode === 0 && response.Response) {
    const categoryList = response.Response.CategoryList || [];
    const mappedCategories: GiftCategoryItem[] = categoryList.map((cat: any) => ({
      id: cat.CategoryId,
      name: cat.CategoryName,
      description: cat.CategoryDesc || '',
      extensionInfo: cat.CategoryExtension,
      giftIds: cat.GiftIdList || [],
      giftCount: (cat.GiftIdList || []).length,
      languageList: cat.LanguageList || [],
    }));
    return { categories: mappedCategories, total: mappedCategories.length };
  }

  throw new Error(response?.ErrorInfo || 'TRTC API error');
}

export async function createGiftCategory(params: CreateGiftCategoryParams): Promise<any> {
  const response = await trtcRequest(TRTCApi.addGiftCategory, {
    CategoryId: params.categoryId,
    DefaultName: params.defaultName,
    DefaultDesc: params.defaultDesc,
    ExtensionInfo: params.extensionInfo,
  });

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    return { code: 0, message: 'success' };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

export async function deleteGiftCategory(categoryId: string): Promise<any> {
  const response = await trtcRequest(TRTCApi.delGiftCategory, { CategoryId: categoryId });

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    return { code: 0, message: 'success' };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

export async function updateGiftCategory(params: CreateGiftCategoryParams): Promise<any> {
  const response = await trtcRequest(TRTCApi.editGiftCategory, {
    CategoryId: params.categoryId,
    DefaultName: params.defaultName,
    DefaultDesc: params.defaultDesc || '',
    ExtensionInfo: params.extensionInfo || '',
  });

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    return { code: 0, message: 'success' };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

export async function getGiftCategory(categoryId: string): Promise<any> {
  return trtcRequest(TRTCApi.getGiftCategory, { CategoryId: categoryId });
}

// ========== 礼物语言信息 ==========

export async function getGiftLanguage(giftId: string, language: string): Promise<{ name: string; description: string }> {
  const response = await trtcRequest(TRTCApi.getGiftLanguage, { GiftId: giftId, Language: language });

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    const giftInfo = response.GiftInfo || response.Gift || response;
    return {
      name: giftInfo.Name || giftInfo.name || '',
      description: giftInfo.Desc || giftInfo.description || '',
    };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

export async function setGiftLanguage(giftId: string, language: string, name: string, description?: string): Promise<void> {
  const response = await trtcRequest(TRTCApi.setGiftLanguage, {
    GiftId: giftId,
    Language: language,
    Name: name,
    Desc: description || '',
  });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}

export async function delGiftLanguage(giftId: string, language: string): Promise<void> {
  const response = await trtcRequest(TRTCApi.delGiftLanguage, { GiftId: giftId, Language: language });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}

// ========== 礼物分类语言信息 ==========

export async function getGiftCategoryLanguage(categoryId: string, language: string): Promise<{ name: string; description: string }> {
  const response = await trtcRequest(TRTCApi.getGiftCategoryLanguage, { CategoryId: categoryId, Language: language });

  if (response.ErrorCode === 0 || response.ActionStatus === 'OK') {
    return {
      name: response.CategoryInfo?.CategoryName || '',
      description: response.CategoryInfo?.CategoryDesc || '',
    };
  }
  throw new Error(response.ErrorInfo || 'TRTC API failed');
}

export async function setGiftCategoryLanguage(categoryId: string, language: string, name: string, description?: string): Promise<void> {
  const response = await trtcRequest(TRTCApi.setGiftCategoryLanguage, {
    CategoryId: categoryId,
    Language: language,
    CategoryName: name,
    CategoryDesc: description || '',
  });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}

export async function delGiftCategoryLanguage(categoryId: string, language: string): Promise<void> {
  const response = await trtcRequest(TRTCApi.delGiftCategoryLanguage, { CategoryId: categoryId, Language: language });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}

// ========== 礼物分类关系 ==========

export async function addGiftCategoryRelations(categoryId: string, giftIdList: string[]): Promise<void> {
  const response = await trtcRequest(TRTCApi.addGiftCategoryRelations, { CategoryId: categoryId, GiftIdList: giftIdList });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}

export async function delGiftCategoryRelations(categoryId: string, giftIdList: string[]): Promise<void> {
  const response = await trtcRequest(TRTCApi.delGiftCategoryRelations, { CategoryId: categoryId, GiftIdList: giftIdList });
  if (response.ErrorCode !== 0 && response.ActionStatus !== 'OK') {
    throw new Error(response.ErrorInfo || 'TRTC API failed');
  }
}
