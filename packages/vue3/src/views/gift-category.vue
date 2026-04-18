<template>
  <div class="gift-category-container">
    <!-- 页面头部 -->
    <div class="gift-category-page-header">
      <div class="gift-category-title-section">
        <t-button variant="outline" shape="circle" class="back-btn" @click="goBack" title="返回列表">
          <template #icon><ArrowLeftIcon /></template>
        </t-button>
        <h1>类别管理</h1>
      </div>
      <div class="gift-category-actions">
        <div :class="['create-category-btn-wrapper', { disabled: categoryList.length >= MAX_CATEGORY_COUNT }]">
          <t-button
            theme="primary"
            shape="round"
            :disabled="categoryList.length >= MAX_CATEGORY_COUNT"
            @click="openCreateDialog"
          >
            ＋ 新建类别
          </t-button>
          <div v-if="categoryList.length >= MAX_CATEGORY_COUNT" class="create-category-tooltip">
            礼物类别数量已达上限，请先删除不需要的类别后再新增
          </div>
        </div>
      </div>
    </div>

    <!-- 类别表格 -->
    <div class="gift-category-table-wrapper">
      <div class="category-list-content">
        <table class="category-table">
          <thead>
            <tr>
              <th class="col-id">类别ID</th>
              <th class="col-name">类别名称</th>
              <th class="col-desc">类别描述</th>
              <th class="col-languages">多语言配置</th>
              <th class="col-count">礼物数量</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody v-if="loading">
            <tr>
              <td colspan="6">
                <div class="category-loading-container">
                  <div class="category-loading-spinner" />
                  <span class="category-loading-text">加载中...</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else-if="categoryList.length === 0">
            <tr>
              <td colspan="6">
                <div class="category-empty-container">
                  <span class="category-empty-text">请先创建礼物分类，再进行配置</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="item in categoryList" :key="item.id">
              <td>
                <div class="gift-id">
                  <span>{{ item.id || '-' }}</span>
                  <copy-icon
                    class="gift-id-copy"
                    size="14"
                    @click="handleCopyId(item.id)"
                  />
                </div>
              </td>
              <td>
                <span class="category-name">{{ item.name || '-' }}</span>
              </td>
              <td>
                <span class="category-desc">{{ item.description || '-' }}</span>
              </td>
              <td>
                <div class="category-lang-tags">
                  <template v-if="item.languageList && item.languageList.length > 0">
                    <span
                      v-for="lang in item.languageList"
                      :key="getLangCode(lang)"
                      class="category-lang-tag"
                      @click="openLangEditDialog(item.id, getLangKey(lang))"
                    >
                      {{ getLangLabel(getLangCode(lang)) }}
                    </span>
                  </template>
                  <span v-else class="category-lang-empty">-</span>
                  <edit-icon
                    class="category-lang-edit-icon"
                    size="14"
                    @click="openLangConfigDialog(item.id)"
                  />
                </div>
              </td>
              <td>
                <span class="category-count">{{ item.giftCount ?? 0 }}</span>
              </td>
              <td>
                <div class="category-actions">
                  <t-button variant="text" theme="primary" shape="round" @click="openEditDialog(item)">编辑</t-button>
                  <t-button variant="text" theme="primary" shape="round" @click="handleDelete(item)">删除</t-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="isEdit ? '编辑类别' : '新建类别'"
      width="500px"
      placement="center"
      class="gift-modal"
      :confirm-btn="{
        content: submitting ? '创建中...' : (isEdit ? '保存' : '创建'),
        disabled: submitting || !formData.categoryId.trim() || !formData.name.trim(),
        loading: submitting,
        shape: 'round',
      }"
      :cancel-btn="{ shape: 'round' }"
      :on-confirm="handleSubmit"
    >
      <t-form class="gift-modal-body" :label-width="100" :colon="false">
        <!-- 类别ID -->
        <t-form-item label="类别 ID" :required-mark="true">
          <t-input
            v-model="formData.categoryId"
            placeholder="请输入类别 ID"
            :disabled="isEdit"
            :status="getByteLength(formData.categoryId) > CATEGORY_ID_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(formData.categoryId) > CATEGORY_ID_MAX_BYTES ? `类别ID不能超过 ${CATEGORY_ID_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(formData.categoryId) > CATEGORY_ID_MAX_BYTES }]">
                {{ getByteLength(formData.categoryId) }}/{{ CATEGORY_ID_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>

        <!-- 类别名称 -->
        <t-form-item label="类别名称" :required-mark="true">
          <t-input
            v-model="formData.name"
            placeholder="请输入类别名称"
            :status="getByteLength(formData.name) > CATEGORY_NAME_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(formData.name) > CATEGORY_NAME_MAX_BYTES ? `类别名称不能超过 ${CATEGORY_NAME_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(formData.name) > CATEGORY_NAME_MAX_BYTES }]">
                {{ getByteLength(formData.name) }}/{{ CATEGORY_NAME_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>

        <!-- 描述 -->
        <t-form-item label="描述">
          <t-input
            v-model="formData.description"
            placeholder="输入类别描述"
            :status="getByteLength(formData.description) > CATEGORY_DESC_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(formData.description) > CATEGORY_DESC_MAX_BYTES ? `类别描述不能超过 ${CATEGORY_DESC_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(formData.description) > CATEGORY_DESC_MAX_BYTES }]">
                {{ getByteLength(formData.description) }}/{{ CATEGORY_DESC_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 类别多语言配置弹窗 -->
    <t-dialog
      v-model:visible="langConfigVisible"
      header="类别多语言配置"
      width="680px"
      placement="center"
      class="gift-lang-config-dialog"
      :confirm-btn="{ content: '关闭', shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      :on-close="closeLangConfigDialog"
    >
      <div class="category-lang-config-container">
        <!-- 提示信息 -->
        <div class="category-lang-config-info-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0">
            <circle cx="8" cy="8" r="7" stroke="#1C66E5" stroke-width="1.5"/>
            <path d="M8 7V11" stroke="#1C66E5" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="8" cy="5" r="0.75" fill="#1C66E5"/>
          </svg>
          <span>使用多语言配置时：获取指定语言的礼物分类信息时，若已配置该语言内容，则返回对应语言信息；若未配置，则返回创建礼物分类时设置的默认语言信息。</span>
        </div>
        
        <!-- 语言配置表格 -->
        <table class="category-lang-config-table">
          <thead>
            <tr>
              <th>语言类型</th>
              <th>类别名称</th>
              <th>类别描述</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="langKey in LANG_CONFIG_KEYS" :key="langKey">
              <td>{{ LANG_MAP[langKey].label }}</td>
              <td class="category-lang-table-cell-name">
                <template v-if="categoryLangConfig[langKey].name">{{ categoryLangConfig[langKey].name }}</template>
                <span v-else class="category-lang-table-empty">未配置</span>
              </td>
              <td class="category-lang-table-cell-desc">
                <template v-if="categoryLangConfig[langKey].description">{{ categoryLangConfig[langKey].description }}</template>
                <span v-else class="category-lang-table-empty">未配置</span>
              </td>
              <td>
                <div class="category-lang-table-actions">
                  <t-link theme="primary" hover="color" @click="editingId && openLangEditDialog(editingId, langKey)">编辑</t-link>
                  <t-link
                    theme="danger"
                    hover="color"
                    :disabled="!categoryLangConfig[langKey].name && !categoryLangConfig[langKey].description"
                    @click="editingId && handleLangClear(editingId, langKey)"
                  >清除</t-link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </t-dialog>

    <!-- 语言编辑子弹窗 -->
    <t-dialog
      v-model:visible="langEditVisible"
      :header="editingLang ? `编辑${LANG_MAP[editingLang].label}信息` : ''"
      width="420px"
      placement="center"
      class="gift-lang-edit-modal"
      :confirm-btn="{ content: '保存', shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      @confirm="handleLangEditSave"
    >
      <t-form class="gift-modal-body" :label-width="100" :colon="false">
        <t-form-item label="类别名称">
          <t-input
            v-model="langEditForm.name"
            :placeholder="editingLang ? `请输入${LANG_MAP[editingLang].label}类别名称` : ''"
            :status="getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES ? `类别名称不能超过 ${CATEGORY_NAME_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES }]">
                {{ getByteLength(langEditForm.name) }}/{{ CATEGORY_NAME_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>
        <t-form-item label="类别描述">
          <t-input
            v-model="langEditForm.description"
            :placeholder="editingLang ? `请输入${LANG_MAP[editingLang].label}类别描述` : ''"
            :status="getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES ? `类别描述不能超过 ${CATEGORY_DESC_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES }]">
                {{ getByteLength(langEditForm.description) }}/{{ CATEGORY_DESC_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>
      </t-form>
    </t-dialog>
    <t-dialog
      v-model:visible="deleteDialogVisible"
      header="确定要删除该类别吗？"
      width="400px"
      placement="center"
      :confirm-btn="{ theme: 'primary', content: '删除', shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      @confirm="confirmDelete"
    >
      <p>删除后无法撤销</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { PlusIcon, ArrowLeftIcon, CopyIcon, EditIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { copyText } from '@/utils';
import {
  getGiftCategoryList,
  createGiftCategory,
  deleteGiftCategory,
  updateGiftCategory,
  getGiftCategoryLanguage,
  setGiftCategoryLanguage,
  delGiftCategoryLanguage,
} from '@/api/gift';
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
  getLangLabel,
  getLangCode,
  convertGiftCategoriesToCategoryItems,
} from '@live-manager/common';
import '@live-manager/common/style/gift-category.css';

const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref('');
const categoryList = ref<CategoryItem[]>([]);
const searchValue = ref('');

// 表单数据
const formData = reactive({
  categoryId: '',
  name: '',
  description: '',
});

// 多语言配置
const langConfigVisible = ref(false);
const categoryLangConfig = reactive<CategoryLangConfig>({
  sc: { name: '', description: '' },
  tc: { name: '', description: '' },
  en: { name: '', description: '' },
});

// 语言编辑子弹窗
const langEditVisible = ref(false);
const editingLang = ref<LangKey | null>(null);
const editingCategoryForLang = ref('');
const langEditForm = reactive({ name: '', description: '' });

// 删除弹窗
const deleteDialogVisible = ref(false);
const deletingItem = ref<CategoryItem | null>(null);

// 获取类别列表
const fetchCategoryList = async (useCache = true) => {
  if (useCache) {
    const cached = sessionStorage.getItem('gift_categories_cache');
    if (cached) {
      try {
        const cachedCategories = JSON.parse(cached);
        const categories = convertGiftCategoriesToCategoryItems(cachedCategories);
        if (categories.length > 0) {
          categoryList.value = categories;
          sessionStorage.removeItem('gift_categories_cache');
          return;
        }
      } catch {
        // 解析缓存类别数据失败，静默忽略
      }
    }
  }
  
  loading.value = true;
  try {
    const result = await getGiftCategoryList();
    const categories = convertGiftCategoriesToCategoryItems(result.categories || []);
    categoryList.value = categories.length > 0 ? categories : [];
  } catch (error: any) {
    console.error('获取类别列表失败:', error);
    MessagePlugin.error(`获取类别列表失败: ${error.ErrorInfo || error.message || '网络错误'}`);
    categoryList.value = [];
  } finally {
    loading.value = false;
  }
};

// 复制ID
const handleCopyId = (id: string) => {
  copyText(String(id || ''));
  MessagePlugin.success('类别ID已复制');
};

// 从语言对象获取语言key
const getLangKey = (lang: any): LangKey | undefined => {
  const langCode = getLangCode(lang);
  return getLangKeyByCode(langCode);
};

// 打开新增弹窗
const openCreateDialog = () => {
  isEdit.value = false;
  editingId.value = '';
  resetForm();
  dialogVisible.value = true;
};

// 打开编辑弹窗
const openEditDialog = (row: CategoryItem) => {
  isEdit.value = true;
  editingId.value = row.id;
  formData.categoryId = row.id;
  formData.name = row.name || '';
  formData.description = row.description || '';
  dialogVisible.value = true;
};

// 重置表单
const resetForm = () => {
  formData.categoryId = '';
  formData.name = '';
  formData.description = '';
};

// 打开语言配置弹窗
const openLangConfigDialog = (categoryId: string) => {
  editingId.value = categoryId;
  categoryLangConfig.sc = { name: '', description: '' };
  categoryLangConfig.tc = { name: '', description: '' };
  categoryLangConfig.en = { name: '', description: '' };

  const category = categoryList.value.find(c => c.id === categoryId);
  if (category?.languageList && category.languageList.length > 0) {
    for (const lang of category.languageList) {
      const langObj = typeof lang === 'string' ? null : lang;
      if (langObj?.Language) {
        const langKey = LANG_CODE_TO_KEY[langObj.Language];
        if (langKey) {
          categoryLangConfig[langKey] = { name: langObj.CategoryName || '', description: langObj.CategoryDesc || '' };
        }
      }
    }
  }

  langConfigVisible.value = true;
};

// 关闭语言配置弹窗
const closeLangConfigDialog = () => {
  langConfigVisible.value = false;
};

// 打开语言编辑弹窗
const openLangEditDialog = (categoryId: string, lang: LangKey | undefined) => {
  if (!lang) return;
  editingCategoryForLang.value = categoryId;
  editingLang.value = lang;

  const category = categoryList.value.find(c => c.id === categoryId);
  const langCode = LANG_MAP[lang].code;
  const cached = category?.languageList?.find((l: CategoryLanguageDetail) =>
    (typeof l === 'string' ? l : l.Language) === langCode
  );
  if (cached && typeof cached !== 'string') {
    langEditForm.name = cached.CategoryName || '';
    langEditForm.description = cached.CategoryDesc || '';
  } else {
    langEditForm.name = '';
    langEditForm.description = '';
  }

  langEditVisible.value = true;
};

// 保存单个语言编辑
const handleLangEditSave = async () => {
  if (!editingCategoryForLang.value || !editingLang.value) return;

  if (langEditForm.name && getByteLength(langEditForm.name) > CATEGORY_NAME_MAX_BYTES) {
    MessagePlugin.error(`类别名称不能超过 ${CATEGORY_NAME_MAX_BYTES} 字节`);
    return;
  }
  if (langEditForm.description && getByteLength(langEditForm.description) > CATEGORY_DESC_MAX_BYTES) {
    MessagePlugin.error(`类别描述不能超过 ${CATEGORY_DESC_MAX_BYTES} 字节`);
    return;
  }
  
  try {
    if (langEditForm.name) {
      await setGiftCategoryLanguage(editingCategoryForLang.value, LANG_MAP[editingLang.value].code, langEditForm.name, langEditForm.description);
      MessagePlugin.success('语言信息保存成功');
    }
    langEditVisible.value = false;
    await fetchCategoryList(false);
    
    if (langConfigVisible.value) {
      categoryLangConfig[editingLang.value] = { ...langEditForm };
    }
  } catch (error: any) {
    MessagePlugin.error(`保存失败: ${error.message || '未知错误'}`);
  }
};

// 清除单个语言配置
const handleLangClear = async (categoryId: string, lang: LangKey) => {
  try {
    await delGiftCategoryLanguage(categoryId, LANG_MAP[lang].code);
    MessagePlugin.success('语言配置已清除');
    categoryLangConfig[lang] = { name: '', description: '' };
    await fetchCategoryList(false);
  } catch (error: any) {
    MessagePlugin.error(`清除失败: ${error.message || '未知错误'}`);
  }
};

// 提交表单
const handleSubmit = async () => {
  if (!formData.categoryId.trim()) {
    MessagePlugin.error('请输入类别ID');
    return;
  }
  if (!formData.name.trim()) {
    MessagePlugin.error('请输入类别名称');
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateGiftCategory({
        categoryId: editingId.value,
        defaultName: formData.name.trim(),
        defaultDesc: formData.description.trim(),
        extensionInfo: '',
      });
      MessagePlugin.success('类别更新成功');
    } else {
      await createGiftCategory({
        categoryId: formData.categoryId.trim(),
        defaultName: formData.name.trim(),
        defaultDesc: formData.description.trim(),
        extensionInfo: '',
      });
      MessagePlugin.success('类别创建成功');
    }
    
    dialogVisible.value = false;
    await fetchCategoryList();
  } catch (error: any) {
    const errorMsg = error?.ErrorInfo || error?.message || '未知错误';
    MessagePlugin.error(`操作失败: ${errorMsg}`);
  } finally {
    submitting.value = false;
  }
};

// 删除类别
const handleDelete = (row: CategoryItem) => {
  deletingItem.value = row;
  deleteDialogVisible.value = true;
};

const confirmDelete = async () => {
  if (!deletingItem.value) return;
  
  try {
    await deleteGiftCategory(deletingItem.value.id);
    MessagePlugin.success('类别已删除');
    await fetchCategoryList();
  } catch (error: any) {
    const errorMsg = error?.ErrorInfo || error?.message || '未知错误';
    MessagePlugin.error(`删除失败: ${errorMsg}`);
  } finally {
    deleteDialogVisible.value = false;
    deletingItem.value = null;
  }
};

// 返回礼物管理
const goBack = () => {
  router.push('/gift-config');
};

// 初始化
let fetching = false;
onMounted(() => {
  if (fetching) return;
  fetching = true;
  fetchCategoryList();
});
</script>
