import React, { useState, useEffect, useRef } from 'react';
import { useAppNavigate } from '../hooks/useAppNavigate';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
} from 'tdesign-icons-react';
import { copyText } from '../utils';
import {
  Button,
  Dialog,
  Input,
} from 'tdesign-react';

import { FormLayout, FormField } from '../components/FormField';
// 导入消息提示组件
import { Message } from '../components/Toast';
// 导入API函数
import {
  getGiftCategoryList,
  createGiftCategory,
  deleteGiftCategory,
  updateGiftCategory,
  getGiftCategoryLanguage,
  setGiftCategoryLanguage,
  delGiftCategoryLanguage
} from '../api/gift';
// 从 common 导入类型、常量和工具函数
import type { CategoryItem, CategoryLangConfig, LangKey, CategoryLanguageDetail } from '@live-manager/common';
import {
  LANG_MAP,
  LANG_CODE_TO_KEY,
  LANG_CONFIG_KEYS,
  MAX_CATEGORY_COUNT,
  CATEGORY_ID_MAX_BYTES,
  CATEGORY_NAME_MAX_BYTES,
  CATEGORY_DESC_MAX_BYTES,
  getByteLength,
  getLangKeyByCode,
  convertGiftCategoriesToCategoryItems,
  DIALOG_WIDTH,
} from '@live-manager/common';
import '@live-manager/common/style/gift-category.css';

export default function GiftCategory() {
  const navigate = useAppNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [categoryList, setCategoryList] = useState<CategoryItem[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [langConfigVisible, setLangConfigVisible] = useState(false);

  // 防止 StrictMode 导致的重复请求
  const fetchingRef = useRef(false);

  // 表单数据
  const [formData, setFormData] = useState({
    categoryId: '',
    name: '',
    description: '',
  });

  // 多语言配置数据
  const [categoryLangConfig, setCategoryLangConfig] = useState<CategoryLangConfig>({
    sc: { name: '', description: '' },
    tc: { name: '', description: '' },
    en: { name: '', description: '' },
  });

  // 语言编辑子弹窗状态
  const [langEditVisible, setLangEditVisible] = useState(false);
  const [editingLang, setEditingLang] = useState<LangKey | null>(null);
  const [editingCategoryForLang, setEditingCategoryForLang] = useState<string>('');
  const [langEditForm, setLangEditForm] = useState({ name: '', description: '' });

  // 表格最大高度（动态计算）
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState(600);

  // 动态计算表格可用高度
  useEffect(() => {
    const calculateTableHeight = () => {
      if (!tableRef.current) return;

      const viewportHeight = window.innerHeight;
      const cardElement = tableRef.current.closest('.gift-category-table-wrapper');
      if (!cardElement) return;

      const cardRect = cardElement.getBoundingClientRect();
      const availableHeight = viewportHeight - cardRect.top - 60 - 24;
      setTableMaxHeight(Math.max(200, availableHeight));
    };

    calculateTableHeight();
    window.addEventListener('resize', calculateTableHeight);

    const resizeObserver = new ResizeObserver(calculateTableHeight);
    if (tableRef.current) {
      resizeObserver.observe(tableRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateTableHeight);
      resizeObserver.disconnect();
    };
  }, []);

  // 获取类别列表 - 使用后端API
  const fetchCategoryList = async (useCache = true) => {
    // 优先使用缓存数据
    if (useCache) {
      const cached = sessionStorage.getItem('gift_categories_cache');
      if (cached) {
        try {
          const cachedCategories = JSON.parse(cached);
          const categories = convertGiftCategoriesToCategoryItems(cachedCategories);
          if (categories.length > 0) {
            setCategoryList(categories);
            sessionStorage.removeItem('gift_categories_cache'); // 使用后清除缓存
            return;
          }
        } catch {
          // 解析缓存类别数据失败，静默忽略
        }
      }
    }

    setLoading(true);
    try {
      const result = await getGiftCategoryList();
      const categories = convertGiftCategoriesToCategoryItems(result.categories || []);
      setCategoryList(categories.length > 0 ? categories : []);
    } catch (error: any) {
      console.error('获取类别列表失败:', error);
      Message.error(`获取类别列表失败: ${error.ErrorInfo || error.message || '网络错误'}`);
      // 使用空数组作为fallback
      setCategoryList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 防止 StrictMode 导致的重复请求
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    fetchCategoryList();
  }, []);

  // 打开新增弹窗
  const openCreateDialog = () => {
    setIsEdit(false);
    setEditingId('');
    resetForm();
    setDialogVisible(true);
  };

  // 打开编辑弹窗
  const openEditDialog = (row: CategoryItem) => {
    setIsEdit(true);
    setEditingId(row.id);
    setFormData({
      categoryId: row.id,
      name: row.name || '',
      description: row.description || '',
    });
    setDialogVisible(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      categoryId: '',
      name: '',
      description: '',
    });
  };

  // 打开语言配置弹窗（表格模式）- 从列表中点击铅笔图标触发
  const openLangConfigDialog = async (categoryId: string) => {
    setEditingId(categoryId);
    const initConfig: CategoryLangConfig = {
      sc: { name: '', description: '' },
      tc: { name: '', description: '' },
      en: { name: '', description: '' },
    };

    // 优先从已有的 languageList 预填数据
    const category = categoryList.find(c => c.id === categoryId);
    const langsToFetch: LangKey[] = []; // 需要通过 API 获取的语言
    if (category?.languageList && category.languageList.length > 0) {
      for (const lang of category.languageList) {
        const langObj = typeof lang === 'string' ? null : lang;
        const langCode = typeof lang === 'string' ? lang : lang.Language;
        const langKey = LANG_CODE_TO_KEY[langCode];
        if (langKey) {
          if (langObj && (langObj.CategoryName || langObj.CategoryDesc)) {
            // 有完整数据，直接使用
            initConfig[langKey] = { name: langObj.CategoryName || '', description: langObj.CategoryDesc || '' };
          } else {
            // 仅有语言代码，需要 API 获取
            langsToFetch.push(langKey);
          }
        }
      }
    }

    setCategoryLangConfig(initConfig);
    setLangConfigVisible(true);

    // 异步获取缺失的语言数据
    if (langsToFetch.length > 0) {
      try {
        const results = await Promise.allSettled(
          langsToFetch.map(async (langKey) => {
            const result = await getGiftCategoryLanguage(categoryId, LANG_MAP[langKey].code);
            return { langKey, result };
          })
        );
        setCategoryLangConfig(prev => {
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
  const closeLangConfigDialog = () => {
    setLangConfigVisible(false);
  };

  // ========== 语言编辑子弹窗相关 ==========

  // 打开语言编辑弹窗（从列表tag或从配置表格点击编辑）
  const openLangEditDialog = async (categoryId: string, lang: LangKey) => {
    // 优先从 languageList 缓存读取
    const category = categoryList.find(c => c.id === categoryId);
    const langCode = LANG_MAP[lang].code;
    const cached = category?.languageList?.find((l: CategoryLanguageDetail) =>
      (typeof l === 'string' ? l : l.Language) === langCode
    );

    // 先计算好 form 数据，最后一次性设置所有 state（确保 React batch 渲染时 Input 拿到正确值）
    let formData = { name: '', description: '' };

    // 如果缓存中有完整的对象数据（含 CategoryName 字段），直接使用
    if (cached && typeof cached !== 'string' && (cached.CategoryName || cached.CategoryDesc)) {
      formData = { name: cached.CategoryName || '', description: cached.CategoryDesc || '' };
    } else if (cached) {
      // languageList 中存在该语言（可能只是字符串或空对象），需要调用 API 获取实际数据
      try {
        const result = await getGiftCategoryLanguage(categoryId, langCode);
        formData = { name: result.name || '', description: result.description || '' };
      } catch {
        // API 获取失败则保持空值
      }
    }

    // 一次性设置所有 state，确保 React batch 后 Dialog 渲染时 Input 值已就绪
    setEditingCategoryForLang(categoryId);
    setEditingLang(lang);
    setLangEditForm(formData);
    setLangEditVisible(true);
  };

  // 保存单个语言编辑
  const handleLangEditSave = async () => {
    if (!editingCategoryForLang || !editingLang) return;

    // 字节校验
    if (langEditForm.name && getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES) {
      Message.error(`类别名称不能超过 ${CATEGORY_NAME_MAX_BYTES} 字节`);
      return;
    }
    if (langEditForm.description && getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES) {
      Message.error(`类别描述不能超过 ${CATEGORY_DESC_MAX_BYTES} 字节`);
      return;
    }

    try {
      if (langEditForm.name) {
        await setGiftCategoryLanguage(editingCategoryForLang, LANG_MAP[editingLang].code, langEditForm.name, langEditForm.description);
        Message.success('语言信息保存成功');
      }
      setLangEditVisible(false);
      await fetchCategoryList(false);

      // 如果多语言配置弹窗也打开着，同步更新
      if (langConfigVisible) {
        setCategoryLangConfig(prev => ({
          ...prev,
          [editingLang!]: { ...langEditForm }
        }));
      }
    } catch (error: any) {
      Message.error(`保存失败: ${error.message || '未知错误'}`);
    }
  };

  // 清除单个语言配置
  const handleLangClear = async (categoryId: string, lang: LangKey) => {
    try {
      await delGiftCategoryLanguage(categoryId, LANG_MAP[lang].code);
      Message.success('语言配置已清除');
      setCategoryLangConfig(prev => ({
        ...prev,
        [lang]: { name: '', description: '' }
      }));
      await fetchCategoryList(false);
    } catch (error: any) {
      Message.error(`清除失败: ${error.message || '未知错误'}`);
    }
  };

  // 提交表单 - 调用 TRTC API
  const handleSubmit = async () => {
    if (!formData.categoryId.trim()) {
      Message.error('请输入类别ID');
      return;
    }
    if (!formData.name.trim()) {
      Message.error('请输入类别名称');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        // 编辑模式：调用 TRTC edit_gift_category API
        await updateGiftCategory({
          categoryId: editingId,
          defaultName: formData.name.trim(),
          defaultDesc: formData.description.trim(),
          extensionInfo: ''
        });
        Message.success('类别更新成功');
      } else {
        // 创建模式：调用 TRTC add_gift_category API
        await createGiftCategory({
          categoryId: formData.categoryId.trim(),
          defaultName: formData.name.trim(),
          defaultDesc: formData.description.trim(),
          extensionInfo: ''
        });

        Message.success('类别创建成功');
      }

      setDialogVisible(false);
      fetchCategoryList();
    } catch (error: any) {
      const errorMsg = error?.ErrorInfo || error?.message || '未知错误';
      Message.error(`操作失败: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 删除类别
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletingItem, setDeletingItem] = useState<CategoryItem | null>(null);

  const handleDelete = (row: CategoryItem) => {
    setDeletingItem(row);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    try {
      // 调用 TRTC del_gift_category API
      await deleteGiftCategory(deletingItem.id);
      Message.success('类别已删除');
      fetchCategoryList();
    } catch (error: any) {
      const errorMsg = error?.ErrorInfo || error?.message || '未知错误';
      Message.error(`删除失败: ${errorMsg}`);
    } finally {
      setDeleteDialogVisible(false);
      setDeletingItem(null);
    }
  };

  // 返回礼物管理
  const goBack = () => {
    navigate('/gift-config');
  };

  return (
    <div className="gift-category-container">
      {/* 页面头部 */}
      <div className="gift-category-page-header">
        <div className="gift-category-title-section">
          <Button shape="square" variant="text" className="back-btn" onClick={goBack} icon={<ArrowLeftIcon />} />
          <h1>类别管理</h1>
        </div>
        <div className="gift-category-actions">
          <div className={`create-category-btn-wrapper${categoryList.length >= MAX_CATEGORY_COUNT ? ' disabled' : ''}`}>
            <Button
              shape="round"
              theme="primary"
              onClick={openCreateDialog}
              disabled={categoryList.length >= MAX_CATEGORY_COUNT}
            >
              ＋ 新建类别
            </Button>
            {categoryList.length >= MAX_CATEGORY_COUNT && (
              <div className="create-category-tooltip">
                礼物类别数量已达上限，请先删除不需要的类别后再新增
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 类别表格 */}
      <div className="gift-category-table-wrapper" ref={tableRef}>
        <div className="category-list-content" style={{ maxHeight: tableMaxHeight }}>
          <table className="category-table">
            <thead>
              <tr>
                <th className="col-id">类别ID</th>
                <th className="col-name">类别名称</th>
                <th className="col-desc">类别描述</th>
                <th className="col-languages">多语言配置</th>
                <th className="col-count">礼物数量</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="category-loading-container">
                      <div className="category-loading-spinner" />
                      <span className="category-loading-text">加载中...</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : categoryList.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="category-empty-container">
                      <span className="category-empty-text">请先创建礼物分类，再进行配置</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {categoryList.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="gift-id">
                        <span>{item.id || '-'}</span>
                        <svg
                          className="gift-id-copy"
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          onClick={() => { copyText(String(item.id || '')); Message.success('类别ID已复制'); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M3 10V3.5C3 2.67 3.67 2 4.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </div>
                    </td>
                    <td>
                      <span className="category-name">{item.name || '-'}</span>
                    </td>
                    <td>
                      <span className="category-desc">{item.description || '-'}</span>
                    </td>
                    <td>
                      <div className="category-lang-tags">
                        {item.languageList && item.languageList.length > 0 ? (
                          item.languageList.map((lang: CategoryLanguageDetail) => {
                            const langCode = typeof lang === 'string' ? lang : lang.Language;
                            const langKey = LANG_CODE_TO_KEY[langCode];
                            const langInfo = langKey ? LANG_MAP[langKey] : null;
                            return (
                              <span
                                key={langCode}
                                className="category-lang-tag"
                                onClick={() => item && langKey && openLangEditDialog(item.id, langKey)}
                              >
                                {langInfo?.label || langCode}
                              </span>
                            );
                          })
                        ) : (
                          <span className="category-lang-empty">-</span>
                        )}
                        <svg
                          className="category-lang-edit-icon"
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          onClick={() => item && openLangConfigDialog(item.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <path d="M10.5 3.5L12.5 5.5M2 14L2.5 11.5L11 3L13 5L4.5 13.5L2 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </td>
                    <td>
                      <span className="category-count">{item.giftCount ?? 0}</span>
                    </td>
                    <td>
                      <div className="category-actions">
                        <Button
                          variant="text"
                          theme="primary"
                          onClick={() => item && openEditDialog(item)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="text"
                          theme="primary"
                          onClick={() => item && handleDelete(item)}
                        >
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* 新增/编辑弹窗 */}
      <Dialog
        visible={dialogVisible}
        header={isEdit ? '编辑类别' : '新建类别'}
        onClose={() => setDialogVisible(false)}
        width={DIALOG_WIDTH.CATEGORY_FORM}
        placement="center"
        className="category-dialog"
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => setDialogVisible(false)}>
              取消
            </Button>
            <Button
              shape="round"
              theme="primary"
              onClick={handleSubmit}
              disabled={submitting || !formData.categoryId.trim() || !formData.name.trim()}
            >
              {submitting ? '创建中...' : (isEdit ? '保存' : '创建')}
            </Button>
          </>
        }
      >
        <FormLayout labelWidth={100}>
          {/* 类别ID */}
          <FormField label="类别 ID" requiredMark>
            <div className="form-field__input-wrapper">
              <Input
                value={formData.categoryId}
                onChange={(value) => setFormData(prev => ({ ...prev, categoryId: String(value) }))}
                placeholder="请输入类别 ID"
                disabled={isEdit}
                status={getByteLength(formData.categoryId) > CATEGORY_ID_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(formData.categoryId) > CATEGORY_ID_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(formData.categoryId)}/{CATEGORY_ID_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(formData.categoryId) > CATEGORY_ID_MAX_BYTES && (
                <div className="form-field__error-tip">类别ID不能超过 {CATEGORY_ID_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>

          {/* 类别名称 */}
          <FormField label="类别名称" requiredMark>
            <div className="form-field__input-wrapper">
              <Input
                value={formData.name}
                onChange={(value) => setFormData(prev => ({ ...prev, name: String(value) }))}
                placeholder="请输入类别名称"
                status={getByteLength(formData.name) > CATEGORY_NAME_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(formData.name) > CATEGORY_NAME_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(formData.name)}/{CATEGORY_NAME_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(formData.name) > CATEGORY_NAME_MAX_BYTES && (
                <div className="form-field__error-tip">类别名称不能超过 {CATEGORY_NAME_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>

          {/* 描述 */}
          <FormField label="描述">
            <div className="form-field__input-wrapper">
              <Input
                value={formData.description}
                onChange={(value) => setFormData(prev => ({ ...prev, description: String(value) }))}
                placeholder="输入类别描述"
                status={getByteLength(formData.description) > CATEGORY_DESC_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(formData.description) > CATEGORY_DESC_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(formData.description)}/{CATEGORY_DESC_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(formData.description) > CATEGORY_DESC_MAX_BYTES && (
                <div className="form-field__error-tip">类别描述不能超过 {CATEGORY_DESC_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>
        </FormLayout>
      </Dialog>

      {/* 类别多语言配置弹窗 - 表格模式 */}
      <Dialog
        visible={langConfigVisible}
        header="类别多语言配置"
        onClose={closeLangConfigDialog}
        width={DIALOG_WIDTH.GIFT_LANG_CONFIG}
        placement="center"
        className="category-lang-config-dialog"
        footer={
          <Button shape="round" theme="primary" onClick={closeLangConfigDialog}>
            关闭
          </Button>
        }
      >
        <div className="category-lang-config-container">
          {/* 提示信息 */}
          <div className="category-lang-config-info-banner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="#1C66E5" strokeWidth="1.5" />
              <path d="M8 7V11" stroke="#1C66E5" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="5" r="0.75" fill="#1C66E5" />
            </svg>
            <span>使用多语言配置时：获取指定语言的礼物分类信息时，若已配置该语言内容，则返回对应语言信息；若未配置，则返回创建礼物分类时设置的默认语言信息。</span>
          </div>

          {/* 语言配置表格 */}
          <table className="category-lang-config-table">
            <thead>
              <tr>
                <th>语言类型</th>
                <th>类别名称</th>
                <th>类别描述</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {LANG_CONFIG_KEYS.map((langKey) => {
                const config = categoryLangConfig[langKey];
                const langInfo = LANG_MAP[langKey];
                return (
                  <tr key={langKey}>
                    <td>{langInfo.label}</td>
                    <td className="category-lang-table-cell-name">{config.name || <span className="category-lang-table-empty">未配置</span>}</td>
                    <td className="category-lang-table-cell-desc">{config.description || <span className="category-lang-table-empty">未配置</span>}</td>
                    <td>
                      <div className="category-lang-table-actions">
                        <Button variant="text" theme="primary" className="category-lang-table-action-link" onClick={() => editingId && openLangEditDialog(editingId, langKey)}>编辑</Button>
                        <Button variant="text" theme="danger" className="category-lang-table-action-link category-lang-table-action-danger" disabled={!config.name && !config.description} onClick={() => editingId && handleLangClear(editingId, langKey)}>清除</Button>
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
        key={`cat-lang-edit-${editingCategoryForLang}-${editingLang}`}
        destroyOnClose
        visible={langEditVisible && !!editingLang}
        header={editingLang ? `编辑${LANG_MAP[editingLang].label}信息` : ''}
        onClose={() => setLangEditVisible(false)}
        width={DIALOG_WIDTH.GIFT_EDIT}
        placement="center"
        className="category-lang-edit-modal"
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
        <FormLayout labelWidth={100}>
          <FormField label="类别名称">
            <div className="form-field__input-wrapper">
              <Input
                value={langEditForm.name}
                onChange={(value) => setLangEditForm(prev => ({ ...prev, name: String(value) }))}
                placeholder={editingLang ? `请输入${LANG_MAP[editingLang].label}类别名称` : ''}
                status={getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(langEditForm.name)}/{CATEGORY_NAME_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES && (
                <div className="form-field__error-tip">类别名称不能超过 {CATEGORY_NAME_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>
          <FormField label="类别描述">
            <div className="form-field__input-wrapper">
              <Input
                value={langEditForm.description}
                onChange={(value) => setLangEditForm(prev => ({ ...prev, description: String(value) }))}
                placeholder={editingLang ? `请输入${LANG_MAP[editingLang].label}类别描述` : ''}
                status={getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(langEditForm.description)}/{CATEGORY_DESC_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES && (
                <div className="form-field__error-tip">类别描述不能超过 {CATEGORY_DESC_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>
        </FormLayout>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog
        visible={deleteDialogVisible && !!deletingItem}
        header="确定要删除该类别吗？"
        onClose={() => setDeleteDialogVisible(false)}
        width={DIALOG_WIDTH.GIFT_DELETE}
        placement="center"
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
