import { useState, useEffect, useRef } from 'react';
import {
  FileCopyIcon,
  EditIcon,
  SearchIcon,
  AdjustmentIcon,
} from 'tdesign-icons-react';
import { useAppNavigate } from '../hooks/useAppNavigate';
import {
  Button,
  Card,
  Dialog,
  Input,
  InputNumber,
  Textarea,
  Select,
} from 'tdesign-react';

const { Option } = Select;

import { FormLayout, FormField } from '../components/FormField';
import { copyText } from '../utils';

// 导入消息提示组件
import { Message } from '../components/Toast';
import ImageUpload from '../components/ImageUpload';
import type { ImageUploadRef } from '../components/ImageUpload';
import { getUploadConfig } from '../api/upload';
import '@live-manager/common/style/gift-config.css';

// 从公共库导入类型、常量和工具函数
import type { GiftItem, LangKey, GiftLangConfig } from '@live-manager/common';
import {
  LANG_MAP,
  LANG_CODE_TO_KEY,
  LANG_CONFIG_KEYS,
  GIFT_ID_MAX_BYTES,
  GIFT_NAME_MAX_BYTES,
  GIFT_DESC_MAX_BYTES,
  GIFT_EXT_MAX_BYTES,
  GIFT_SEARCH_MAX_BYTES,
  getByteLength,
  truncateToMaxBytes,
  formatTime,
  getLangCode,
  DIALOG_WIDTH,
  resolveMultipleImageUploads,
  ImageUploadResolveError,
} from '@live-manager/common';

// 导入API函数
import {
  getGiftList,
  createGift,
  updateGift,
  deleteGift,
  setGiftLanguage,
  delGiftLanguage,
  addGiftCategoryRelations,
  delGiftCategoryRelations
} from '../api/gift';


export default function GiftConfig() {
  const navigate = useAppNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [giftList, setGiftList] = useState<GiftItem[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [displayList, setDisplayList] = useState<GiftItem[]>([]);

  // 防止 StrictMode 导致的重复请求
  const fetchingRef = useRef(false);

  // 上传配置
  const [uploadEnabled, setUploadEnabled] = useState(false);
  useEffect(() => {
    getUploadConfig().then(config => setUploadEnabled(config.enabled)).catch(() => { });
  }, []);

  // 延迟上传相关 ref 和状态
  const iconUploadRef = useRef<ImageUploadRef>(null);
  const animUploadRef = useRef<ImageUploadRef>(null);
  const [hasPendingIcon, setHasPendingIcon] = useState(false);
  const [hasPendingAnim, setHasPendingAnim] = useState(false);

  // URL 错误状态追踪（由 ImageUpload 组件回调通知）
  const [iconUrlError, setIconUrlError] = useState(false);
  const [animUrlError, setAnimUrlError] = useState(false);

  // 跳转到类别管理，携带已获取的类别数据
  const goToCategoryManagement = () => {
    if (categoryList.length > 0) {
      sessionStorage.setItem('gift_categories_cache', JSON.stringify(categoryList));
    }
    navigate('/gift-category');
  };

  // 价格/等级常量
  const GIFT_PRICE_MIN = 0;
  const GIFT_PRICE_MAX = 2147483647;
  const GIFT_LEVEL_MIN = 1;
  const GIFT_LEVEL_MAX = 99;

  // clamp 工具：超出范围自动修正
  const clampNumber = (
    value: string | number | null | undefined,
    min: number,
    max: number,
    fallback: number,
  ) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numericValue));
  };

  // 表单数据
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    iconUrl: '',
    price: 0,
    animationUrl: '',
    level: '',
    description: '',
    extensionInfo: '',
    enabled: true,
  });
  const [langConfigVisible, setLangConfigVisible] = useState(false);
  const [giftLangConfig, setGiftLangConfig] = useState<GiftLangConfig>({
    sc: { name: '', description: '' },
    tc: { name: '', description: '' },
    en: { name: '', description: '' },
  });

  // 语言编辑子弹窗状态
  const [langEditVisible, setLangEditVisible] = useState(false);
  const [editingLang, setEditingLang] = useState<LangKey | null>(null);
  const [editingGiftForLang, setEditingGiftForLang] = useState<string>('');
  const [langEditForm, setLangEditForm] = useState({ name: '', description: '' });

  // 类别编辑弹窗状态
  const [categoryEditVisible, setCategoryEditVisible] = useState(false);
  const [editingCategoryGift, setEditingCategoryGift] = useState<GiftItem | null>(null);
  const [allCategories, setAllCategories] = useState<Array<{ id: string; name: string; giftIds: string[] }>>([]);
  const [giftCategoryIds, setGiftCategoryIds] = useState<string[]>([]);
  const [categoryAddPopVisible, setCategoryAddPopVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // 类别删除确认弹窗状态
  const [categoryDeleteVisible, setCategoryDeleteVisible] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string>('');

  // 可添加的类别列表
  const availableCategories = allCategories.filter(cat => !giftCategoryIds.includes(cat.id));

  // 表格 ref
  const tableRef = useRef<HTMLDivElement>(null);

  // 打开新增弹窗
  const openCreateDialog = () => {
    setIsEdit(false);
    setEditingId('');
    resetForm();
    // 清理 ImageUpload 组件内部状态，防止显示上次编辑的缓存
    iconUploadRef.current?.reset();
    animUploadRef.current?.reset();
    setDialogVisible(true);
  };

  // 打开编辑弹窗
  const openEditDialog = async (row: GiftItem) => {
    setIsEdit(true);
    setEditingId(row.id);
    // 先重置 ImageUpload 组件，清理上一次的缓存/验证状态
    iconUploadRef.current?.reset();
    animUploadRef.current?.reset();
    setFormData({
      id: row.id,
      name: row.name,
      iconUrl: row.iconUrl,
      price: row.price,
      animationUrl: row.animationUrl || '',
      level: row.level || '',
      description: row.description || '',
      extensionInfo: row.extensionInfo || '',
      enabled: row.enabled,
    });

    setDialogVisible(true);
    // 编辑时，如果已有 URL 则自动切换到 URL 模式
    setTimeout(() => {
      if (row.iconUrl && iconUploadRef.current) {
        iconUploadRef.current.switchToUrlMode();
      }
      if (row.animationUrl && animUploadRef.current) {
        animUploadRef.current.switchToUrlMode();
      }
    }, 0);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      iconUrl: '',
      price: 0,
      animationUrl: '',
      level: '',
      description: '',
      extensionInfo: '',
      enabled: true,
    });
    setHasPendingIcon(false);
    setHasPendingAnim(false);
  };

  // 打开语言配置弹窗（表格模式）- 从列表中点击铅笔图标触发
  const openGiftLangConfigDialog = async (giftId: string) => {
    setEditingId(giftId);
    const initConfig: GiftLangConfig = {
      sc: { name: '', description: '' },
      tc: { name: '', description: '' },
      en: { name: '', description: '' },
    };

    // 优先从已有的 languageList 预填数据
    const gift = giftList.find(g => g.id === giftId);
    const langsToFetch: LangKey[] = []; // 需要通过 API 获取的语言
    if (gift?.languageList && gift.languageList.length > 0) {
      for (const lang of gift.languageList) {
        const langObj = typeof lang === 'string' ? null : lang;
        const langCode = typeof lang === 'string' ? lang : lang.Language;
        const langKey = LANG_CODE_TO_KEY[langCode];
        if (langKey) {
          if (langObj && (langObj.Name || langObj.Desc)) {
            // 有完整数据，直接使用
            initConfig[langKey] = { name: langObj.Name || '', description: langObj.Desc || '' };
          } else {
            // 仅有语言代码，需要 API 获取
            langsToFetch.push(langKey);
          }
        }
      }
    }

    setGiftLangConfig(initConfig);
    setLangConfigVisible(true);

    // 异步获取缺失的语言数据
    if (langsToFetch.length > 0) {
      try {
        const { getGiftLanguage } = await import('../api/gift');
        const results = await Promise.allSettled(
          langsToFetch.map(async (langKey) => {
            const result = await getGiftLanguage(giftId, LANG_MAP[langKey].code);
            return { langKey, result };
          })
        );
        setGiftLangConfig(prev => {
          const updated = { ...prev };
          for (const r of results) {
            if (r.status === 'fulfilled') {
              const { langKey, result } = r.value;
              updated[langKey] = { name: result.name || '', description: result.description || '' };
            }
          }
          return updated;
        });
      } catch {
        // API 获取失败，保持空值
      }
    }
  };

  // 关闭语言配置弹窗
  const closeGiftLangConfigDialog = () => {
    setLangConfigVisible(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    // 验证
    if (!formData.id.trim()) {
      Message.error('请输入礼物ID');
      return;
    }
    if (getByteLength(formData.id) > GIFT_ID_MAX_BYTES) {
      Message.error(`礼物ID不能超过 ${GIFT_ID_MAX_BYTES} 字节`);
      return;
    }
    if (!formData.name.trim()) {
      Message.error('请输入礼物名称');
      return;
    }
    if (getByteLength(formData.name) > GIFT_NAME_MAX_BYTES) {
      Message.error(`礼物名称不能超过 ${GIFT_NAME_MAX_BYTES} 字节`);
      return;
    }
    if (formData.description && getByteLength(formData.description) > GIFT_DESC_MAX_BYTES) {
      Message.error(`礼物描述不能超过 ${GIFT_DESC_MAX_BYTES} 字节`);
      return;
    }
    // 等级范围校验
    const levelNum = parseInt(formData.level);
    if (formData.level && (!isNaN(levelNum) && (levelNum < GIFT_LEVEL_MIN || levelNum > GIFT_LEVEL_MAX))) {
      Message.error(`礼物等级必须在 ${GIFT_LEVEL_MIN} ~ ${GIFT_LEVEL_MAX} 之间`);
      return;
    }
    // 价格范围校验
    if (formData.price < GIFT_PRICE_MIN || formData.price > GIFT_PRICE_MAX) {
      Message.error(`礼物价格必须在 ${GIFT_PRICE_MIN} ~ ${GIFT_PRICE_MAX} 之间`);
      return;
    }
    // 缩略图必填校验（如果有待上传文件，则先不上传，等提交时自动上传）
    // 如果处于 URL 模式且输入框有值（但可能尚未验证通过），跳过此检查，交给后续 ensureUrlValidated 处理
    const iconInUrlModeForCheck = iconUploadRef.current?.isUrlInputMode ?? true;
    const hasUrlInput = iconInUrlModeForCheck && (iconUploadRef.current?.urlInputValue?.trim?.() || '');
    if (!hasPendingIcon && !formData.iconUrl.trim() && !hasUrlInput) {
      // 如果处于 URL 模式，设置输入框错误让其变红
      if (iconInUrlModeForCheck) {
        iconUploadRef.current?.setUrlError('请输入缩略图 URL');
      }
      Message.error('请上传缩略图或输入缩略图 URL');
      return;
    }
    // 验证 extensionInfo
    if (formData.extensionInfo.trim()) {
      try {
        JSON.parse(formData.extensionInfo.trim());
      } catch {
        Message.error('自定义扩展信息必须为合法的 JSON 格式');
        return;
      }
      if (new TextEncoder().encode(formData.extensionInfo.trim()).length > 100) {
        Message.error('自定义扩展信息不能超过 100 字节');
        return;
      }
    }

    setSubmitting(true);

    try {
      // 并行解析缩略图和素材 URL（公共逻辑自动处理 URL 验证 / 文件上传 / fallback）
      let iconUrl: string;
      let animationUrl: string;
      try {
        [iconUrl, animationUrl] = await resolveMultipleImageUploads([
          {
            handle: iconUploadRef.current,
            hasPendingFile: hasPendingIcon,
            fallbackUrl: formData.iconUrl,
            label: '缩略图',
          },
          {
            handle: animUploadRef.current,
            hasPendingFile: hasPendingAnim,
            fallbackUrl: formData.animationUrl,
            label: '礼物素材',
          },
        ]);
      } catch (err: any) {
        Message.error(err instanceof ImageUploadResolveError ? err.message : `图片处理失败: ${err.message || '未知错误'}`);
        setSubmitting(false);
        return;
      }

      if (isEdit) {
        // 编辑
        await updateGift(editingId, {
          name: formData.name,
          iconUrl,
          price: formData.price,
          animationUrl,
          level: formData.level ? parseInt(formData.level) : undefined,
          description: formData.description,
          extensionInfo: formData.extensionInfo.trim() || undefined,
        });
      } else {
        // 新增
        await createGift({
          id: formData.id,
          name: formData.name,
          iconUrl,
          price: formData.price,
          animationUrl,
          enabled: formData.enabled,
          level: formData.level ? parseInt(formData.level) : undefined,
          description: formData.description,
          extensionInfo: formData.extensionInfo.trim() || undefined,
        });
      }

      Message.success(isEdit ? '礼物更新成功' : '礼物创建成功');
      // 刷新列表
      await fetchGiftList();
      setDialogVisible(false);
    } catch (error: any) {
      Message.error(`操作失败: ${error.ErrorInfo || error.message || '未知错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 删除礼物
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletingItem, setDeletingItem] = useState<GiftItem | null>(null);

  // ========== 语言编辑子弹窗相关 ==========

  // 打开语言编辑弹窗（从列表中点击tag或从多语言配置弹窗点击编辑）
  const openLangEditDialog = async (giftId: string, lang: LangKey) => {
    // 优先从 languageList 缓存读取
    const gift = giftList.find(g => g.id === giftId);
    const langCode = LANG_MAP[lang].code;
    const cached = gift?.languageList?.find((l: any) =>
      (typeof l === 'string' ? l : l.Language) === langCode
    );

    // 先计算好 form 数据，最后一次性设置所有 state（确保 React batch 渲染时 Input 拿到正确值）
    let formData = { name: '', description: '' };

    // 如果缓存中有完整的对象数据（含 Name 字段），直接使用
    if (cached && typeof cached !== 'string' && (cached.Name || cached.Desc)) {
      formData = { name: cached.Name || '', description: cached.Desc || '' };
    } else if (cached) {
      // languageList 中存在该语言（可能只是字符串或空对象），需要调用 API 获取实际数据
      try {
        const { getGiftLanguage } = await import('../api/gift');
        const result = await getGiftLanguage(giftId, langCode);
        formData = { name: result.name || '', description: result.description || '' };
      } catch {
        // API 获取失败则保持空值
      }
    }

    // 一次性设置所有 state，确保 React batch 后 Dialog 渲染时 Input 值已就绪
    setEditingGiftForLang(giftId);
    setEditingLang(lang);
    setLangEditForm(formData);
    setLangEditVisible(true);
  };

  // 保存单个语言编辑
  const handleLangEditSave = async () => {
    if (!editingGiftForLang || !editingLang) return;

    // 字节校验
    if (langEditForm.name && getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES) {
      Message.error(`礼物名称不能超过 ${GIFT_NAME_MAX_BYTES} 字节`);
      return;
    }
    if (langEditForm.description && getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES) {
      Message.error(`礼物描述不能超过 ${GIFT_DESC_MAX_BYTES} 字节`);
      return;
    }

    try {
      if (langEditForm.name) {
        await setGiftLanguage(editingGiftForLang, LANG_MAP[editingLang].code, langEditForm.name, langEditForm.description);
        Message.success('语言信息保存成功');
      }
      setLangEditVisible(false);
      await fetchGiftList();

      // 如果多语言配置弹窗也打开着，同步更新
      if (langConfigVisible) {
        setGiftLangConfig(prev => ({
          ...prev,
          [editingLang!]: { ...langEditForm }
        }));
      }
    } catch (error: any) {
      Message.error(`保存失败: ${error.message || '未知错误'}`);
    }
  };

  // 清除单个语言配置
  const handleLangClear = async (giftId: string, lang: LangKey) => {
    try {
      await delGiftLanguage(giftId, LANG_MAP[lang].code);
      Message.success('语言配置已清除');
      // 更新本地状态
      setGiftLangConfig(prev => ({
        ...prev,
        [lang]: { name: '', description: '' }
      }));
      await fetchGiftList();
    } catch (error: any) {
      Message.error(`清除失败: ${error.message || '未知错误'}`);
    }
  };

  // ========== 类别编辑弹窗相关 ==========

  const openCategoryEditDialog = async (item: GiftItem) => {
    setEditingCategoryGift(item);
    setCategoryAddPopVisible(false);
    setSelectedCategoryId('');

    // 构建所有类别列表
    const categories = categoryList.map((cat: any) => ({
      id: String(cat.id || cat.CategoryId || ''),
      name: cat.name || cat.CategoryName || '',
      giftIds: (cat.giftIds || cat.GiftIdList || []).map(String),
    }));
    setAllCategories(categories);

    // 获取该礼物当前的类别ID列表（确保字符串类型一致）
    const currentCategoryIds = (item.categoryIds || []).map(String);

    // 如果 categoryIds 为空，尝试从 allCategories 反查
    if (currentCategoryIds.length === 0 && categories.length > 0) {
      const inferredIds = categories
        .filter(cat => cat.giftIds.includes(String(item.id)))
        .map(cat => cat.id);
      setGiftCategoryIds(inferredIds);
    } else {
      setGiftCategoryIds(currentCategoryIds);
    }

    setCategoryEditVisible(true);
  };

  // 从礼物移除某个类别
  // 打开类别删除确认弹窗
  const handleRemoveCategory = (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    setCategoryDeleteVisible(true);
  };

  // 确认移除类别
  const confirmRemoveCategory = async () => {
    if (!editingCategoryGift || !deletingCategoryId) return;

    try {
      await delGiftCategoryRelations(deletingCategoryId, [editingCategoryGift.id]);
      setGiftCategoryIds(prev => prev.filter(id => id !== deletingCategoryId));
      Message.success('已移除类别');
      await fetchGiftList();
    } catch (error: any) {
      Message.error(`操作失败: ${error.message || '未知错误'}`);
    } finally {
      setCategoryDeleteVisible(false);
      setDeletingCategoryId('');
    }
  };

  // 确认添加类别
  const handleAddCategoryConfirm = async () => {
    if (!editingCategoryGift || !selectedCategoryId) return;

    try {
      await addGiftCategoryRelations(selectedCategoryId, [editingCategoryGift.id]);
      setGiftCategoryIds(prev => [...prev, selectedCategoryId]);
      setCategoryAddPopVisible(false);
      setSelectedCategoryId('');
      Message.success('已添加类别');
      await fetchGiftList();
    } catch (error: any) {
      Message.error(`操作失败: ${error.message || '未知错误'}`);
    }
  };

  const handleDelete = (row: GiftItem) => {
    setDeletingItem(row);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    try {
      await deleteGift(deletingItem.id);
      Message.success('礼物已删除');

      // 刷新列表
      await fetchGiftList();
    } catch (error: any) {
      Message.error(`删除失败: ${error.ErrorInfo || error.message || '未知错误'}`);
    } finally {
      setDeleteDialogVisible(false);
      setDeletingItem(null);
    }
  };

  // 获取礼物列表
  const fetchGiftList = async () => {
    setLoading(true);

    try {
      const result = await getGiftList();
      setGiftList(result.gifts);
      setDisplayList(result.gifts);
      // 同时保存类别列表，供类别管理页面复用
      if (result.categories && result.categories.length > 0) {
        setCategoryList(result.categories);
      }
    } catch (error: any) {
      console.error('获取礼物列表失败:', error);
      Message.error(`获取礼物列表失败: ${error.ErrorInfo || error.message || '网络错误'}`);
      setGiftList([]);
      setDisplayList([]);
    } finally {
      setLoading(false);
    }
  };

  // 搜索礼物：在本地列表中模糊匹配（ID、名称、描述、类别）
  const handleSearch = async (keyword?: string) => {
    const input = (keyword ?? searchInput).trim().toLowerCase();
    if (!input) {
      return;
    }
    if (getByteLength(keyword ?? searchInput) > GIFT_SEARCH_MAX_BYTES) {
      Message.error('输入内容太长');
      return;
    }

    const localResults = giftList.filter(gift => {
      const id = (gift.id || '').toLowerCase();
      const name = (gift.name || '').toLowerCase();
      const description = (gift.description || '').toLowerCase();
      const categories = (gift.categories || []).join(',').toLowerCase();
      return id.includes(input) || name.includes(input) || description.includes(input) || categories.includes(input);
    });

    if (localResults.length > 0) {
      setDisplayList(localResults);
      Message.success(`找到 ${localResults.length} 个匹配结果`);
    } else {
      setDisplayList([]);
      Message.error(`未找到与"${(keyword ?? searchInput).trim()}"相关的礼物`);
    }
  };

  // 清除搜索（仅清空输入，恢复完整列表）
  const handleClearSearch = () => {
    setSearchInput('');
    setDisplayList(giftList);
  };

  // 输入变化时实时过滤
  const handleSearchInputChange = (value: string) => {
    const v = String(value);
    setSearchInput(v);
    if (getByteLength(v) > GIFT_SEARCH_MAX_BYTES) {
      return;
    }
    const input = v.trim().toLowerCase();
    if (!input) {
      setDisplayList(giftList);
      return;
    }
    const filtered = giftList.filter(gift => {
      const id = (gift.id || '').toLowerCase();
      const name = (gift.name || '').toLowerCase();
      const description = (gift.description || '').toLowerCase();
      const categories = (gift.categories || []).join(',').toLowerCase();
      return id.includes(input) || name.includes(input) || description.includes(input) || categories.includes(input);
    });
    setDisplayList(filtered);
  };

  useEffect(() => {
    // 防止 StrictMode 导致的重复请求
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    fetchGiftList();
  }, []);

  return (
    <div className="gift-config-container">
      {/* 页面头部 */}
      <div className="gift-config-page-header">
        <h1 className="gift-config-title">礼物管理</h1>
        <div className="gift-config-actions">
          <Input
            value={searchInput}
            onChange={(value) => {
              handleSearchInputChange(String(value ?? ''));
            }}
            onEnter={() => {
              if (getByteLength(searchInput) > GIFT_SEARCH_MAX_BYTES) {
                Message.error('输入内容太长');
                return;
              }
              handleSearch();
            }}
            clearable
            onClear={handleClearSearch}
            placeholder="搜索礼物ID、名称、描述..."
            suffixIcon={<SearchIcon size={16} />}
            className="gift-config-search-input"
            status={getByteLength(searchInput) > GIFT_SEARCH_MAX_BYTES ? 'error' : 'default'}
            tips={getByteLength(searchInput) > GIFT_SEARCH_MAX_BYTES ? '输入内容超出长度限制' : ''}
          />
          <Button shape="round" theme='primary' onClick={goToCategoryManagement} variant="outline" icon={<AdjustmentIcon />}>
            类别管理
          </Button>
          <Button shape="round" onClick={openCreateDialog} theme="primary">
           ＋ 新建礼物
          </Button>
        </div>
      </div>

      {/* 礼物表格卡片 */}
      <Card className="gift-list-card" ref={tableRef}>
        {/* 表头 - 固定 */}
        <div className="gift-list-header-fixed">
          <table className="gift-table">
            <thead>
              <tr>
                <th className="col-id">礼物ID</th>
                <th className="col-thumbnail">缩略图</th>
                <th className="col-name">名称</th>
                <th className="col-desc">描述</th>
                <th className="col-category">类别</th>
                <th className="gift-col-lang">多语言配置</th>
                <th className="col-level">等级</th>
                <th className="col-price">价格</th>
                <th className="gift-col-time">创建时间</th>
                <th className="gift-col-action">操作</th>
              </tr>
            </thead>
          </table>
        </div>
        {/* 表体 - 滚动 */}
        <div className="gift-list-content">
          {loading ? (
            <div className="gift-loading-container">
              <div className="gift-loading-spinner" />
              <span className="gift-loading-text">加载中...</span>
            </div>
          ) : displayList.length === 0 ? (
            <div className="gift-empty-container">
              <span className="gift-empty-text">暂无礼物数据</span>
            </div>
          ) : (
            <table className="gift-table">
              <tbody>
                {displayList.map((item) => (
                  <tr key={item.id} className="gift-row">
                    <td className="col-id">
                      <div className="gift-id">
                        <span>{item.id || '-'}</span>
                        <FileCopyIcon
                          className="gift-id-copy"
                          size={14}
                          onClick={() => {
                            copyText(String(item.id || ''));
                            Message.success('礼物ID已复制');
                          }}
                        />
                      </div>
                    </td>
                    <td className="col-thumbnail">
                      <div className="gift-thumbnail">
                        {item.iconUrl ? (
                          <img src={item.iconUrl} alt={item.name || 'gift'} />
                        ) : (
                          <span>🎁</span>
                        )}
                      </div>
                    </td>
                    <td className="col-name">
                      <span className="gift-name">{item.name || '-'}</span>
                    </td>
                    <td className="col-desc">
                      <span> {item.description || '-'}</span>
                    </td>
                    <td className="col-category">
                      <div className="gift-category-cell" onClick={() => openCategoryEditDialog(item)}>
                        <span>{item.categories?.join(', ') || '-'}</span>
                        <EditIcon className="gift-category-edit-icon" size={14} />
                      </div>
                    </td>
                    <td className="gift-col-lang">
                      <div className="gift-lang-tags">
                        {item.languageList && item.languageList.length > 0 ? (
                          item.languageList.map((lang: any) => {
                            const langCode = getLangCode(lang);
                            const langKey = LANG_CODE_TO_KEY[langCode];
                            const langInfo = langKey ? LANG_MAP[langKey] : null;
                            return (
                              <span
                                key={langCode}
                                className="gift-lang-tag"
                                onClick={() => langKey && openLangEditDialog(item.id, langKey)}
                              >
                                {langInfo?.label || langCode}
                              </span>
                            );
                          })
                        ) : (
                          <span className="gift-lang-empty">-</span>
                        )}
                        <EditIcon
                          className="gift-lang-edit-icon"
                          size={14}
                          onClick={() => openGiftLangConfigDialog(item.id)}
                        />
                      </div>
                    </td>
                    <td className="col-level">
                      {item.level || '-'}
                    </td>
                    <td className="col-price">
                      <span className="gift-price">{item.price ?? 0}</span>
                    </td>
                    <td className="gift-col-time">
                      <span className="gift-create-time">{formatTime(item.createdAt)}</span>
                    </td>
                    <td className="gift-col-action">
                      <Button variant="text" onClick={() => openEditDialog(item)} theme="primary">
                        编辑
                      </Button>
                      <Button variant="text" onClick={() => handleDelete(item)} theme="primary">
                        删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* 新建/编辑弹窗 */}
      <Dialog
        key={`gift-edit-${editingId}`}
        destroyOnClose
        visible={dialogVisible}
        header={isEdit ? '编辑礼物' : '新建礼物'}
        onClose={() => {
          // 关闭时清理 ImageUpload 组件内部状态（取消验证、清理缓存预览）
          iconUploadRef.current?.reset();
          animUploadRef.current?.reset();
          setDialogVisible(false);
        }}
        width={DIALOG_WIDTH.GIFT_FORM}
        placement="center"
        className="gift-modal"
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => {
              iconUploadRef.current?.reset();
              animUploadRef.current?.reset();
              setDialogVisible(false);
            }}>
              取消
            </Button>
            <Button
              shape="round"
              theme="primary"
              onClick={handleSubmit}
              disabled={submitting || (!isEdit && !formData.id) || !formData.name.trim() || (iconUploadRef.current?.isValidating) || (animUploadRef.current?.isValidating) || iconUrlError || animUrlError}
            >
              {submitting ? (isEdit ? '保存中...' : '创建中...') : (isEdit ? '保存' : '创建')}
            </Button>
          </>
        }
      >
        <FormLayout labelWidth={110}>
          {/* 礼物ID - 仅在创建时显示 */}
          {!isEdit && (
            <FormField label="礼物 ID" requiredMark>
              <div className="form-field__input-wrapper">
                <Input
                  value={formData.id}
                  onChange={(value) => setFormData(prev => ({ ...prev, id: String(value) }))}
                  placeholder="请输入礼物ID"
                  status={getByteLength(formData.id) > GIFT_ID_MAX_BYTES ? 'error' : 'default'}
                  suffix={
                    <span className={`input-suffix-count${getByteLength(formData.id) > GIFT_ID_MAX_BYTES ? ' byte-overflow' : ''}`}>
                      {getByteLength(formData.id)}/{GIFT_ID_MAX_BYTES}
                    </span>
                  }
                />
                {getByteLength(formData.id) > GIFT_ID_MAX_BYTES && (
                  <div className="form-field__error-tip">礼物ID不能超过 {GIFT_ID_MAX_BYTES} 字节</div>
                )}
              </div>
            </FormField>
          )}

          {/* 礼物价格 */}
          <FormField label="礼物价格" requiredMark>
            <InputNumber
              value={formData.price}
              onChange={(value) => setFormData(prev => ({ ...prev, price: Number(value) || GIFT_PRICE_MIN }))}
              min={GIFT_PRICE_MIN}
              max={GIFT_PRICE_MAX}
              decimalPlaces={0}
              allowInputOverLimit
              inputProps={{
                tips: formData.price < GIFT_PRICE_MIN || formData.price > GIFT_PRICE_MAX ? `价格范围 ${GIFT_PRICE_MIN}-${GIFT_PRICE_MAX}` : '',
                status: (formData.price < GIFT_PRICE_MIN || formData.price > GIFT_PRICE_MAX) ? 'error' : 'default',
              }}
              style={{ width: '100%' }}
              placeholder="请输入礼物价格"
            />
          </FormField>

          {/* 礼物等级 */}
          <FormField label="礼物等级">
            <InputNumber
              value={formData.level ? parseInt(formData.level) : undefined}
              onChange={(value) => {
                if (value === null || value === undefined) {
                  setFormData(prev => ({ ...prev, level: '' }));
                  return;
                }
                setFormData(prev => ({ ...prev, level: String(value) }));
              }}
              min={GIFT_LEVEL_MIN}
              max={GIFT_LEVEL_MAX}
              allowInputOverLimit
              inputProps={{
                tips: (() => {
                  const lvl = parseInt(formData.level);
                  return !isNaN(lvl) && (lvl < GIFT_LEVEL_MIN || lvl > GIFT_LEVEL_MAX) ? `等级范围 ${GIFT_LEVEL_MIN}-${GIFT_LEVEL_MAX}` : '';
                })(),
                status: (() => {
                  const lvl = parseInt(formData.level);
                  return !isNaN(lvl) && (lvl < GIFT_LEVEL_MIN || lvl > GIFT_LEVEL_MAX) ? 'error' : 'default';
                })(),
              }}
              style={{ width: '100%' }}
              placeholder="请输入礼物等级"
            />
          </FormField>

          {/* 缩略图 */}
          <FormField label="缩略图" requiredMark>
            <ImageUpload
              ref={iconUploadRef}
              value={formData.iconUrl}
              onChange={(url) => {
                setFormData(prev => ({ ...prev, iconUrl: url }));
                setHasPendingIcon(false);
              }}
              type="gift-icon"
              uploadEnabled={uploadEnabled}
              cropEnabled={true}
              aspectRatio={1}
              placeholder="点击或拖拽上传缩略图"
              previewWidth={120}
              previewHeight={120}
              maxSize={5}
              maxBytes={200}
              deferUpload={uploadEnabled}
              onFileReady={(file) => setHasPendingIcon(!!file)}
              onUrlErrorChange={setIconUrlError}
            />
          </FormField>

          {/* 礼物素材 */}
          <FormField label="礼物素材">
            <ImageUpload
              ref={animUploadRef}
              value={formData.animationUrl}
              onChange={(url) => {
                setFormData(prev => ({ ...prev, animationUrl: url }));
                setHasPendingAnim(false);
              }}
              type="gift-animation"
              uploadEnabled={uploadEnabled}
              cropEnabled={false}
              placeholder="点击或拖拽上传素材"
              previewWidth={120}
              previewHeight={120}
              maxSize={10}
              accept="video/mp4,.svga"
              acceptHint="支持 MP4/SVGA，最大 10MB"
              maxBytes={200}
              deferUpload={uploadEnabled}
              skipSvgaValidation={true}
              onFileReady={(file) => setHasPendingAnim(!!file)}
              onUrlErrorChange={setAnimUrlError}
            />
          </FormField>

          {/* 礼物名称 */}
          <FormField label="礼物名称" requiredMark>
            <div className="form-field__input-wrapper">
              <Input
                value={formData.name}
                onChange={(value) => setFormData(prev => ({ ...prev, name: String(value) }))}
                placeholder="请输入礼物名称"
                status={getByteLength(formData.name) > GIFT_NAME_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(formData.name) > GIFT_NAME_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(formData.name)}/{GIFT_NAME_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(formData.name) > GIFT_NAME_MAX_BYTES && (
                <div className="form-field__error-tip">礼物名称不能超过 {GIFT_NAME_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>

          {/* 描述 */}
          <FormField label="描述">
            <div className="form-field__input-wrapper">
              <Input
                value={formData.description}
                onChange={(value) => setFormData(prev => ({ ...prev, description: String(value) }))}
                placeholder="请输入礼物描述"
                status={getByteLength(formData.description) > GIFT_DESC_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(formData.description) > GIFT_DESC_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(formData.description)}/{GIFT_DESC_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(formData.description) > GIFT_DESC_MAX_BYTES && (
                <div className="form-field__error-tip">礼物描述不能超过 {GIFT_DESC_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>

          {/* 自定义扩展信息 */}
          <FormField label="自定义扩展信息">
            <div className="form-field__input-wrapper">
              <div className="textarea-count-wrapper">
                <Textarea
                  value={formData.extensionInfo}
                  onChange={(value) => setFormData(prev => ({ ...prev, extensionInfo: String(value) }))}
                  placeholder='JSON 格式例如：{"key":"value"}'
                  autosize={{ minRows: 3 }}
                  status={getByteLength(formData.extensionInfo) > GIFT_EXT_MAX_BYTES ? 'error' : 'default'}
                />
                <span className={`textarea-suffix-count${getByteLength(formData.extensionInfo) > GIFT_EXT_MAX_BYTES ? ' byte-overflow' : ''}`}>
                  {getByteLength(formData.extensionInfo)}/{GIFT_EXT_MAX_BYTES}
                </span>
              </div>
              {getByteLength(formData.extensionInfo) > GIFT_EXT_MAX_BYTES && (
                <div className="form-field__error-tip">自定义扩展信息不能超过 {GIFT_EXT_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>
        </FormLayout>
      </Dialog>

      {/* 礼物多语言配置弹窗 - 表格模式 */}
      <Dialog
        visible={langConfigVisible}
        header="礼物多语言配置"
        onClose={closeGiftLangConfigDialog}
        width={DIALOG_WIDTH.GIFT_LANG_CONFIG}
        className="gift-lang-config-dialog"
        footer={
          <Button shape="round" theme="primary" onClick={closeGiftLangConfigDialog}>
            关闭
          </Button>
        }
      >
        <div className="gift-lang-config-container">
          {/* 提示信息 */}
          <div className="gift-lang-config-info-banner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="#1C66E5" strokeWidth="1.5" />
              <path d="M8 7V11" stroke="#1C66E5" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="5" r="0.75" fill="#1C66E5" />
            </svg>
            <span>使用多语言配置时：获取指定语言的礼物信息时，若已配置该语言内容，则返回对应语言信息；若未配置，则返回创建礼物时设置的默认语言信息。</span>
          </div>

          {/* 语言配置表格 */}
          <table className="gift-lang-config-table">
            <thead>
              <tr>
                <th>语言类型</th>
                <th>礼物名称</th>
                <th>礼物描述</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {LANG_CONFIG_KEYS.map((langKey) => {
                const config = giftLangConfig[langKey];
                const langInfo = LANG_MAP[langKey];
                return (
                  <tr key={langKey}>
                    <td>{langInfo.label}</td>
                    <td className="gift-lang-table-cell-name">{config.name || <span className="gift-lang-table-empty">未配置</span>}</td>
                    <td className="gift-lang-table-cell-desc">{config.description || <span className="gift-lang-table-empty">未配置</span>}</td>
                    <td>
                      <div className="gift-lang-table-actions">
                        <Button variant="text" theme="primary" className="gift-lang-table-action-link" onClick={() => editingId && openLangEditDialog(editingId, langKey)}>编辑</Button>
                        <Button variant="text" theme="danger" className="gift-lang-table-action-link gift-lang-table-action-danger" disabled={!config.name && !config.description} onClick={() => editingId && handleLangClear(editingId, langKey)}>清除</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Dialog>

      {/* 语言编辑子弹窗 */}
      <Dialog
        key={`lang-edit-${editingGiftForLang}-${editingLang}`}
        destroyOnClose
        visible={langEditVisible && !!editingLang}
        header={editingLang ? `编辑${LANG_MAP[editingLang].label}信息` : ''}
        onClose={() => setLangEditVisible(false)}
        width={DIALOG_WIDTH.GIFT_EDIT}
        className="gift-lang-edit-modal"
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => setLangEditVisible(false)}>
              取消
            </Button>
            <Button shape="round" theme="primary" onClick={handleLangEditSave}>
              保存
            </Button>
          </>
        }
      >
        <FormLayout labelWidth={110}>
          <FormField label="礼物名称">
            <div className="form-field__input-wrapper">
              <Input
                value={langEditForm.name}
                onChange={(value) => {
                  setLangEditForm(prev => ({ ...prev, name: String(value) }));
                }}
                placeholder={editingLang ? `请输入${LANG_MAP[editingLang].label}礼物名称` : ''}
                status={getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(langEditForm.name)}/{GIFT_NAME_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES && (
                <div className="form-field__error-tip">礼物名称不能超过 {GIFT_NAME_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>
          <FormField label="礼物描述">
            <div className="form-field__input-wrapper">
              <Input
                value={langEditForm.description}
                onChange={(value) => {
                  setLangEditForm(prev => ({ ...prev, description: String(value) }));
                }}
                placeholder={editingLang ? `请输入${LANG_MAP[editingLang].label}礼物描述` : ''}
                status={getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(langEditForm.description)}/{GIFT_DESC_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES && (
                <div className="form-field__error-tip">礼物描述不能超过 {GIFT_DESC_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>
        </FormLayout>
      </Dialog>

      {/* 类别编辑弹窗 */}
      <Dialog
        visible={categoryEditVisible && !!editingCategoryGift}
        header="编辑礼物类别"
        onClose={() => setCategoryEditVisible(false)}
        width={DIALOG_WIDTH.GIFT_EDIT}
        className="gift-category-edit-modal"
        footer={
          <Button shape="round" theme="primary" onClick={() => setCategoryEditVisible(false)}>
            关闭
          </Button>
        }
      >
        <div className="gift-category-edit-tags">
          {giftCategoryIds.map(catId => {
            const cat = allCategories.find(c => String(c.id) === String(catId));
            const displayName = cat?.name || catId;
            return (
              <span key={catId} className="gift-category-edit-tag">
                {displayName}
                <button className="gift-category-edit-tag-close" onClick={() => handleRemoveCategory(catId)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </span>
            );
          })}
          <div className="gift-category-add-wrapper">
            <Button variant="text" theme="primary" onClick={() => setCategoryAddPopVisible(!categoryAddPopVisible)}>
              + 添加
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 类别选择弹窗 */}
      <Dialog
        visible={categoryAddPopVisible}
        header="选择类别"
        onClose={() => setCategoryAddPopVisible(false)}
        width={360}
        placement="center"
        footer={
          <Button shape="round" theme="primary" disabled={!selectedCategoryId} onClick={handleAddCategoryConfirm}>
            确定
          </Button>
        }
      >
        <div className="category-select-list">
          <Select
            value={selectedCategoryId}
            onChange={(value) => setSelectedCategoryId(String(value))}
            placeholder="请选择类别"
            style={{ width: '100%' }}
          >
            {availableCategories.map(cat => (
              <Option key={cat.id} value={cat.id} label={cat.name} />
            ))}
          </Select>
          {availableCategories.length === 0 && (
            <div className="category-select-empty">暂无可添加的类别</div>
          )}
        </div>
      </Dialog>

      {/* 类别删除确认弹窗 */}
      <Dialog
        visible={categoryDeleteVisible}
        header="确定要移除该类别吗？"
        onClose={() => setCategoryDeleteVisible(false)}
        width={400}
        placement="center"
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => setCategoryDeleteVisible(false)}>
              取消
            </Button>
            <Button shape="round" theme="primary" onClick={confirmRemoveCategory}>
              确定
            </Button>
          </>
        }
      >
        <p>移除后该礼物将不再属于此类别</p>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog
        visible={deleteDialogVisible && !!deletingItem}
        header="确定要删除该礼物吗？"
        onClose={() => setDeleteDialogVisible(false)}
        width={DIALOG_WIDTH.GIFT_DELETE}
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => setDeleteDialogVisible(false)}>
              取消
            </Button>
            <Button shape="round" theme="primary" onClick={confirmDelete}>
              删除
            </Button>
          </>
        }
      >
        <p>删除后无法撤销</p>
      </Dialog>
    </div>
  );
}
