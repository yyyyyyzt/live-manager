<template>
  <div class="gift-config-container">
    <!-- 页面头部 -->
    <div class="gift-config-page-header">
      <h1 class="gift-config-title">礼物管理</h1>
      <div class="gift-config-actions">
        <div class="gift-search-input">
          <t-input
            :model-value="searchInput"
            placeholder="搜索礼物ID、名称、描述..."
            clearable
            :status="getByteLength(searchInput) > GIFT_SEARCH_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(searchInput) > GIFT_SEARCH_MAX_BYTES ? '输入内容超出长度限制' : ''"
            @update:model-value="handleSearchInputChange"
            @enter="handleSearch"
            @clear="handleClearSearch"
          >
            <template #suffixIcon>
              <search-icon class="search-icon" @click="handleSearch" />
            </template>
          </t-input>
        </div>
        <t-button variant="outline" shape="round" @click="goToCategoryManagement" theme="primary">
          <template #icon><AdjustmentIcon /></template>
          类别管理
        </t-button>
        <t-button theme="primary" shape="round" @click="openCreateDialog">
         ＋ 新建礼物
        </t-button>
      </div>
    </div>

    <!-- 礼物表格卡片 -->
    <t-card class="gift-list-card">
      <!-- 表头 - 固定 -->
      <div class="gift-list-header-fixed">
        <table class="gift-table">
          <thead>
            <tr>
              <th class="col-id">礼物ID</th>
              <th class="col-thumbnail">缩略图</th>
              <th class="col-name">名称</th>
              <th class="col-desc">描述</th>
              <th class="col-category">类别</th>
              <th class="gift-col-lang">多语言配置</th>
              <th class="col-level">等级</th>
              <th class="col-price">价格</th>
              <th class="gift-col-time">创建时间</th>
              <th class="gift-col-action">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <!-- 表体 - 滚动 -->
      <div class="gift-list-content">
        <table v-if="!loading && displayList.length > 0" class="gift-table">
          <tbody>
            <tr v-for="gift in displayList" :key="gift.id" class="gift-row">
              <td class="col-id">
                <div class="gift-id">
                  <span>{{ gift.id || '-' }}</span>
                  <CopyIcon class="gift-id-copy" size="14" @click="handleCopyId(gift.id)" />
                </div>
              </td>
              <td class="col-thumbnail">
                <div class="gift-thumbnail">
                  <img v-if="gift.iconUrl" :src="gift.iconUrl" :alt="gift.name" />
                  <span v-else>🎁</span>
                </div>
              </td>
              <td class="col-name">
                <span>{{ gift.name || '-' }}</span>
              </td>
              <td class="col-desc">
                <span>{{ gift.description || '-' }}</span>
              </td>
              <td class="col-category">
                <div class="gift-category-cell" @click="openCategoryEditDialog(gift)">
                  <span>{{ gift.categories?.join(', ') || '-' }}</span>
                  <EditIcon class="gift-category-edit-icon" size="14" />
                </div>
              </td>
              <td class="gift-col-lang">
                <div class="gift-lang-tags">
                  <template v-if="gift.languageList && gift.languageList.length > 0">
                    <span
                      v-for="lang in gift.languageList"
                      :key="getLangCode(lang)"
                      class="gift-lang-tag"
                      @click="openLangEditDialog(gift.id, getLangKeyByCode(getLangCode(lang)))"
                    >
                      {{ getLangLabel(getLangCode(lang)) }}
                    </span>
                  </template>
                  <span v-else class="gift-lang-empty">-</span>
                  <EditIcon class="gift-lang-edit-icon" size="14" @click="openGiftLangConfigDialog(gift.id)" />
                </div>
              </td>
              <td class="col-level">
                {{ gift.level || '-' }}
              </td>
              <td class="col-price">
                {{ gift.price ?? 0 }}
              </td>
              <td class="gift-col-time">
                {{ formatTime(gift.createdAt) }}
              </td>
              <td class="gift-col-action">
                <div class="gift-actions">
                  <t-button variant="text" theme="primary" shape="round" @click="openEditDialog(gift)">编辑</t-button>
                  <t-button variant="text" theme="primary" shape="round" @click="handleDelete(gift)">删除</t-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="loading" class="gift-loading-container">
          <div class="gift-loading-spinner" />
          <span class="gift-loading-text">加载中...</span>
        </div>
        <div v-else class="gift-empty-container">
          <span class="gift-empty-text">暂无礼物数据</span>
        </div>
      </div>
    </t-card>

    <!-- 新建/编辑弹窗 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="isEdit ? '编辑礼物' : '新建礼物'"
      width="600px"
      placement="center"
      class="gift-modal"
      :on-close="() => setDialogVisible(false)"
    >
      <template #footer>
        <t-button variant="outline" shape="round" @click="setDialogVisible(false)">取消</t-button>
        <t-button
          theme="primary"
          shape="round"
          :disabled="submitting || (!isEdit && !formData.id) || !formData.name.trim() || iconUploadRef?.isValidating || animUploadRef?.isValidating || iconUploadRef?.hasUrlError || animUploadRef?.hasUrlError"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ submitting ? (isEdit ? '保存中...' : '创建中...') : (isEdit ? '保存' : '创建') }}
        </t-button>
      </template>
      <t-form class="gift-modal-body" label-align="right" :label-width="110" :colon="false">

        <!-- 礼物ID - 仅在创建时显示 -->
        <t-form-item v-if="!isEdit" label="礼物 ID" required-mark>
          <t-input
            v-model="formData.id"
            placeholder="请输入礼物ID"
            :status="getByteLength(formData.id) > GIFT_ID_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(formData.id) > GIFT_ID_MAX_BYTES ? `礼物ID不能超过 ${GIFT_ID_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(formData.id) > GIFT_ID_MAX_BYTES }]">
                {{ getByteLength(formData.id) }}/{{ GIFT_ID_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>

        <!-- 礼物价格 -->
        <t-form-item label="礼物价格" required-mark>
          <t-input-number
            :model-value="formData.price"
            :min="GIFT_PRICE_MIN"
            :max="GIFT_PRICE_MAX"
            :decimal-places="0"
            :status="formData.price < GIFT_PRICE_MIN || formData.price > GIFT_PRICE_MAX ? 'error' : 'default'"
            :tips="formData.price < GIFT_PRICE_MIN || formData.price > GIFT_PRICE_MAX ? `价格范围 ${GIFT_PRICE_MIN}-${GIFT_PRICE_MAX}` : ''"
            style="width: 100%"
            placeholder="请输入礼物价格"
            @update:model-value="handlePriceChange"
          />
        </t-form-item>

        <!-- 礼物等级 -->
        <t-form-item label="礼物等级">
          <t-input-number
            :model-value="formData.levelNum"
            :min="formData.levelNum != null ? GIFT_LEVEL_MIN : undefined"
            :max="formData.levelNum != null ? GIFT_LEVEL_MAX : undefined"
            :status="(formData.levelNum ?? 0) > 0 && ((formData.levelNum ?? 0) < GIFT_LEVEL_MIN || (formData.levelNum ?? 0) > GIFT_LEVEL_MAX) ? 'error' : 'default'"
            :tips="(formData.levelNum ?? 0) > 0 && ((formData.levelNum ?? 0) < GIFT_LEVEL_MIN || (formData.levelNum ?? 0) > GIFT_LEVEL_MAX) ? `等级范围 ${GIFT_LEVEL_MIN}-${GIFT_LEVEL_MAX}` : ''"
            style="width: 100%"
            placeholder="请输入礼物等级"
            @update:model-value="handleLevelChange"
          />
        </t-form-item>

        <!-- 缩略图 -->
        <t-form-item label="缩略图" required-mark>
          <ImageUpload
            ref="iconUploadRef"
            v-model="formData.iconUrl"
            type="gift-icon"
            :upload-enabled="uploadEnabled"
            :crop-enabled="true"
            :aspect-ratio="1"
            placeholder="点击或拖拽上传缩略图"
            :preview-width="120"
            :preview-height="120"
            :max-size="5"
            :max-bytes="200"
            :defer-upload="uploadEnabled"
            @file-ready="(file: File | null) => hasPendingIcon = !!file"
          />
        </t-form-item>

        <!-- 礼物素材 -->
        <t-form-item label="礼物素材">
          <ImageUpload
            ref="animUploadRef"
            v-model="formData.animationUrl"
            type="gift-animation"
            :upload-enabled="uploadEnabled"
            :crop-enabled="false"
            placeholder="点击或拖拽上传素材"
            :preview-width="120"
            :preview-height="120"
            :max-size="10"
            accept="video/mp4,.svga"
            accept-hint="支持 MP4/SVGA，最大 10MB"
            :max-bytes="200"
            :defer-upload="uploadEnabled"
            :skip-svga-validation="true"
            @file-ready="(file: File | null) => hasPendingAnim = !!file"
          />
        </t-form-item>

        <!-- 礼物名称 -->
        <t-form-item label="礼物名称" required-mark>
          <t-input
            v-model="formData.name"
            placeholder="请输入礼物名称"
            :status="getByteLength(formData.name) > GIFT_NAME_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(formData.name) > GIFT_NAME_MAX_BYTES ? `礼物名称不能超过 ${GIFT_NAME_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(formData.name) > GIFT_NAME_MAX_BYTES }]">
                {{ getByteLength(formData.name) }}/{{ GIFT_NAME_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>

        <!-- 描述 -->
        <t-form-item label="描述">
          <t-input
            v-model="formData.description"
            placeholder="请输入礼物描述"
            :status="getByteLength(formData.description) > GIFT_DESC_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(formData.description) > GIFT_DESC_MAX_BYTES ? `礼物描述不能超过 ${GIFT_DESC_MAX_BYTES} 字节` : ''"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(formData.description) > GIFT_DESC_MAX_BYTES }]">
                {{ getByteLength(formData.description) }}/{{ GIFT_DESC_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>

        <!-- 自定义扩展信息 -->
        <t-form-item label="自定义扩展信息">
          <div class="textarea-count-wrapper">
            <t-textarea
              v-model="formData.extensionInfo"
              placeholder='JSON 格式例如：{"key":"value"}'
              :autosize="{ minRows: 3 }"
              :status="getByteLength(formData.extensionInfo) > GIFT_EXT_MAX_BYTES ? 'error' : 'default'"
            />
            <span :class="['textarea-suffix-count', { 'byte-overflow': getByteLength(formData.extensionInfo) > GIFT_EXT_MAX_BYTES }]">
              {{ getByteLength(formData.extensionInfo) }}/{{ GIFT_EXT_MAX_BYTES }}
            </span>
          </div>
          <div v-if="getByteLength(formData.extensionInfo) > GIFT_EXT_MAX_BYTES" class="form-field__error-tip">
            扩展信息不能超过 {{ GIFT_EXT_MAX_BYTES }} 字节
          </div>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 礼物多语言配置弹窗 - 表格模式 -->
    <t-dialog
      v-model:visible="langConfigVisible"
      header="礼物多语言配置"
      width="680px"
      placement="center"
      class="gift-lang-config-dialog"
      :confirm-btn="{ content: '关闭', shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      :on-close="closeGiftLangConfigDialog"
    >
      <div class="gift-lang-config-container">
        <!-- 提示信息 -->
        <div class="gift-lang-config-info-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0">
            <circle cx="8" cy="8" r="7" stroke="#1C66E5" stroke-width="1.5"/>
            <path d="M8 7V11" stroke="#1C66E5" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="8" cy="5" r="0.75" fill="#1C66E5"/>
          </svg>
          <span>使用多语言配置时：获取指定语言的礼物信息时，若已配置该语言内容，则返回对应语言信息；若未配置，则返回创建礼物时设置的默认语言信息。</span>
        </div>
        
        <!-- 语言配置表格 -->
        <table class="gift-lang-config-table">
          <thead>
            <tr>
              <th>语言类型</th>
              <th>礼物名称</th>
              <th>礼物描述</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="langKey in LANG_CONFIG_KEYS" :key="langKey">
              <td>{{ LANG_MAP[langKey].label }}</td>
              <td class="gift-lang-table-cell-name">
                <template v-if="giftLangConfig[langKey].name">{{ giftLangConfig[langKey].name }}</template>
                <span v-else class="gift-lang-table-empty">未配置</span>
              </td>
              <td class="gift-lang-table-cell-desc">
                <template v-if="giftLangConfig[langKey].description">{{ giftLangConfig[langKey].description }}</template>
                <span v-else class="gift-lang-table-empty">未配置</span>
              </td>
              <td>
                <div class="gift-lang-table-actions">
                  <t-link theme="primary" hover="color" @click="editingId && openLangEditDialog(editingId, langKey)">编辑</t-link>
                  <t-link
                    theme="danger"
                    hover="color"
                    :disabled="!giftLangConfig[langKey].name && !giftLangConfig[langKey].description"
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
      :confirm-btn="{ content: '保存', loading: false, shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      @confirm="handleLangEditSave"
    >
      <t-form class="gift-modal-body" label-align="right" :label-width="110" :colon="false">
        <t-form-item label="礼物名称">
          <t-input
            :model-value="langEditForm.name"
            :placeholder="editingLang ? `请输入${LANG_MAP[editingLang].label}礼物名称` : ''"
            :status="getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES ? `礼物名称不能超过 ${GIFT_NAME_MAX_BYTES} 字节` : ''"
            @update:model-value="handleLangGiftNameChange"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES }]">
                {{ getByteLength(langEditForm.name) }}/{{ GIFT_NAME_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>
        <t-form-item label="礼物描述">
          <t-input
            :model-value="langEditForm.description"
            :placeholder="editingLang ? `请输入${LANG_MAP[editingLang].label}礼物描述` : ''"
            :status="getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES ? 'error' : 'default'"
            :tips="getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES ? `礼物描述不能超过 ${GIFT_DESC_MAX_BYTES} 字节` : ''"
            @update:model-value="handleLangGiftDescriptionChange"
          >
            <template #suffix>
              <span :class="['input-suffix-count', { 'byte-overflow': getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES }]">
                {{ getByteLength(langEditForm.description) }}/{{ GIFT_DESC_MAX_BYTES }}
              </span>
            </template>
          </t-input>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 类别编辑弹窗 -->
    <t-dialog
      v-model:visible="categoryEditVisible"
      header="编辑礼物类别"
      width="420px"
      placement="center"
      class="gift-category-edit-modal"
      :confirm-btn="{ content: '关闭', shape: 'round' }"
      :cancel-btn="null"
      @confirm="categoryEditVisible = false"
    >
      <div class="gift-category-edit-tags">
        <template v-if="giftCategoryIds.length > 0">
          <span v-for="catId in giftCategoryIds" :key="catId" class="gift-category-edit-tag">
            {{ getCategoryName(catId) }}
            <button class="gift-category-edit-tag-close" @click="openCategoryDeleteConfirm(catId)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </span>
        </template>
        <div class="gift-category-add-wrapper">
          <t-button size="small" variant="text" theme="primary" @click="openCategorySelectDialog">
            + 添加
          </t-button>
        </div>
      </div>
    </t-dialog>

    <!-- 删除确认弹窗 -->
    <t-dialog
      v-model:visible="deleteDialogVisible"
      header="确定要删除该礼物吗？"
      width="400px"
      placement="center"
      :confirm-btn="{ theme: 'primary', content: '删除', shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      @confirm="confirmDelete"
    >
      <p>删除后无法撤销</p>
    </t-dialog>

    <!-- 类别删除确认弹窗 -->
    <t-dialog
      v-model:visible="categoryDeleteVisible"
      header="确定要移除该类别吗？"
      width="400px"
      placement="center"
      :confirm-btn="{ theme: 'primary', content: '确定', shape: 'round' }"
      :cancel-btn="{ shape: 'round' }"
      @confirm="confirmRemoveCategory"
    >
      <p>移除后该礼物将不再属于此类别</p>
    </t-dialog>

    <!-- 类别选择弹窗 -->
    <t-dialog
      v-model:visible="categorySelectVisible"
      header="选择类别"
      width="360px"
      placement="center"
      :footer="false"
      :on-close="() => categorySelectVisible = false"
    >
      <div class="category-select-list">
        <t-select
          v-model="selectedCategoryId"
          placeholder="请选择类别"
          style="width: 100%"
        >
          <t-option
            v-for="cat in availableCategories"
            :key="cat.id"
            :value="cat.id"
            :label="cat.name"
          />
        </t-select>
        <div v-if="availableCategories.length === 0" class="category-select-empty">
          暂无可添加的类别
        </div>
      </div>
      <div class="category-select-footer">
        <t-button theme="primary" shape="round" :disabled="!selectedCategoryId" @click="confirmAddCategory">
          确定
        </t-button>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { AdjustmentIcon, CopyIcon, EditIcon } from 'tdesign-icons-vue-next';
import { SearchIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { copyText } from '@/utils';
import ImageUpload from '@/components/ImageUpload.vue';
import { getUploadConfig } from '@/api/upload';
import {
  getGiftList,
  createGift,
  updateGift,
  deleteGift,
  getGiftLanguage,
  setGiftLanguage,
  delGiftLanguage,
  addGiftCategoryRelations,
  delGiftCategoryRelations,
} from '@/api/gift';
import type { GiftItem } from '@/types';
import '@live-manager/common/style/gift-config.css';
import './gift-config.css';

// 从公共库导入类型、常量和工具函数
import type { LangKey, GiftLangConfig } from '@live-manager/common';
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
  formatTime,
  getLangCode,
  getLangKeyByCode,
  getLangLabel,
  resolveMultipleImageUploads,
  ImageUploadResolveError,
} from '@live-manager/common';

const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref('');
const giftList = ref<GiftItem[]>([]);
const categoryList = ref<any[]>([]);
const searchInput = ref('');
const displayList = ref<GiftItem[]>([]);

// 上传配置
const uploadEnabled = ref(false);
const iconUploadRef = ref<InstanceType<typeof ImageUpload> | null>(null);
const animUploadRef = ref<InstanceType<typeof ImageUpload> | null>(null);
const hasPendingIcon = ref(false);
const hasPendingAnim = ref(false);

// 表单数据
const formData = reactive({
  id: '',
  name: '',
  iconUrl: '',
  price: 0,
  animationUrl: '',
  levelNum: undefined as number | undefined,
  description: '',
  extensionInfo: '',
  enabled: true,
});

// 多语言配置
const langConfigVisible = ref(false);
const giftLangConfig = reactive<GiftLangConfig>({
  sc: { name: '', description: '' },
  tc: { name: '', description: '' },
  en: { name: '', description: '' },
});

// 语言编辑子弹窗
const langEditVisible = ref(false);
const editingLang = ref<LangKey | null>(null);
const editingGiftForLang = ref('');
const langEditForm = reactive({ name: '', description: '' });

const GIFT_PRICE_MIN = 0;
const GIFT_PRICE_MAX = 2147483647;
const GIFT_LEVEL_MIN = 1;
const GIFT_LEVEL_MAX = 99;

const handlePriceChange = (value: string | number | null | undefined) => {
  formData.price = Number(value) || GIFT_PRICE_MIN;
};

const handleLevelChange = (value: string | number | null | undefined) => {
  if (value === '' || value === null || value === undefined) {
    formData.levelNum = undefined;
    return;
  }
  formData.levelNum = Number(value);
};

const updateLangGiftField = (field: keyof typeof langEditForm, value: string | number | undefined) => {
  langEditForm[field] = String(value ?? '');
};

const handleLangGiftNameChange = (value: string | number | undefined) => {
  updateLangGiftField('name', value);
};

const handleLangGiftDescriptionChange = (value: string | number | undefined) => {
  updateLangGiftField('description', value);
};

// 类别编辑弹窗
const categoryEditVisible = ref(false);
const editingCategoryGift = ref<GiftItem | null>(null);
const allCategories = ref<Array<{ id: string; name: string; giftIds: string[] }>>([]);
const giftCategoryIds = ref<string[]>([]);
const categorySelectVisible = ref(false);
const selectedCategoryId = ref<string>('');

// 删除弹窗
const deleteDialogVisible = ref(false);
const deletingItem = ref<GiftItem | null>(null);

// 类别删除确认弹窗
const categoryDeleteVisible = ref(false);
const deletingCategoryId = ref<string>('');

// 可添加的类别列表
const availableCategories = computed(() => {
  return allCategories.value.filter(cat => !giftCategoryIds.value.includes(cat.id));
});

// 打开类别选择弹窗
const openCategorySelectDialog = () => {
  selectedCategoryId.value = '';
  categorySelectVisible.value = true;
};

// 确认添加类别
const confirmAddCategory = () => {
  if (selectedCategoryId.value) {
    handleAddCategory(selectedCategoryId.value);
  }
};

// 辅助方法：复制礼物ID
const handleCopyId = (id: string) => {
  copyText(String(id || ''));
  MessagePlugin.success('礼物ID已复制');
};

// 获取类别名称
const getCategoryName = (catId: string) => {
  const cat = allCategories.value.find(c => String(c.id) === String(catId));
  return cat?.name || catId;
};

// 跳转到类别管理
const goToCategoryManagement = () => {
  if (categoryList.value.length > 0) {
    sessionStorage.setItem('gift_categories_cache', JSON.stringify(categoryList.value));
  }
  router.push('/gift-category');
};

// 设置对话框可见性
const setDialogVisible = (visible: boolean) => {
  if (!visible) {
    // 关闭时清理 ImageUpload 内部状态（取消验证、清理缓存预览）
    iconUploadRef.value?.reset();
    animUploadRef.value?.reset();
  }
  dialogVisible.value = visible;
};

// 打开新增弹窗
const openCreateDialog = () => {
  isEdit.value = false;
  editingId.value = '';
  resetForm();
  // 清理 ImageUpload 组件内部状态，防止显示上次编辑的缓存
  iconUploadRef.value?.reset();
  animUploadRef.value?.reset();
  dialogVisible.value = true;
};

// 打开编辑弹窗
const openEditDialog = async (row: GiftItem) => {
  isEdit.value = true;
  editingId.value = row.id;
  // 先重置 ImageUpload 组件，清理上一次的缓存/验证状态
  iconUploadRef.value?.reset();
  animUploadRef.value?.reset();
  formData.id = row.id;
  formData.name = row.name;
  formData.iconUrl = row.iconUrl;
  formData.price = row.price;
  formData.animationUrl = row.animationUrl || '';
  formData.levelNum = row.level ? parseInt(row.level) : undefined;
  formData.description = row.description || '';
  formData.extensionInfo = row.extensionInfo || '';
  formData.enabled = row.enabled;
  dialogVisible.value = true;
  // 编辑时，如果已有 URL 则自动切换到 URL 模式
  await nextTick();
  if (row.iconUrl && iconUploadRef.value) {
    iconUploadRef.value.switchToUrlMode();
  }
  if (row.animationUrl && animUploadRef.value) {
    animUploadRef.value.switchToUrlMode();
  }
};

// 重置表单
const resetForm = () => {
  formData.id = '';
  formData.name = '';
  formData.iconUrl = '';
  formData.price = 0;
  formData.animationUrl = '';
  formData.levelNum = undefined;
  formData.description = '';
  formData.extensionInfo = '';
  formData.enabled = true;
  hasPendingIcon.value = false;
  hasPendingAnim.value = false;
};

// 打开语言配置弹窗
const openGiftLangConfigDialog = (giftId: string) => {
  editingId.value = giftId;
  giftLangConfig.sc = { name: '', description: '' };
  giftLangConfig.tc = { name: '', description: '' };
  giftLangConfig.en = { name: '', description: '' };

  const gift = giftList.value.find(g => g.id === giftId);
  if (gift?.languageList && gift.languageList.length > 0) {
    for (const lang of gift.languageList) {
      const langObj = typeof lang === 'string' ? null : lang;
      if (langObj?.Language) {
        const langKey = LANG_CODE_TO_KEY[langObj.Language];
        if (langKey) {
          giftLangConfig[langKey] = { name: langObj.Name || '', description: langObj.Desc || '' };
        }
      }
    }
  }

  langConfigVisible.value = true;
};

// 关闭语言配置弹窗
const closeGiftLangConfigDialog = () => {
  langConfigVisible.value = false;
};

// 打开语言编辑弹窗
const openLangEditDialog = (giftId: string, lang: LangKey) => {
  editingGiftForLang.value = giftId;
  editingLang.value = lang;

  const gift = giftList.value.find(g => g.id === giftId);
  const langCode = LANG_MAP[lang].code;
  const cached = gift?.languageList?.find((l: any) =>
    (typeof l === 'string' ? l : l.Language) === langCode
  );
  if (cached && typeof cached !== 'string') {
    langEditForm.name = cached.Name || '';
    langEditForm.description = cached.Desc || '';
  } else {
    langEditForm.name = '';
    langEditForm.description = '';
  }

  langEditVisible.value = true;
};

// 保存单个语言编辑
const handleLangEditSave = async () => {
  if (!editingGiftForLang.value || !editingLang.value) return;

  if (langEditForm.name && getByteLength(langEditForm.name) > GIFT_NAME_MAX_BYTES) {
    MessagePlugin.error(`礼物名称不能超过 ${GIFT_NAME_MAX_BYTES} 字节`);
    return;
  }
  if (langEditForm.description && getByteLength(langEditForm.description) > GIFT_DESC_MAX_BYTES) {
    MessagePlugin.error(`礼物描述不能超过 ${GIFT_DESC_MAX_BYTES} 字节`);
    return;
  }
  
  try {
    if (langEditForm.name) {
      await setGiftLanguage(editingGiftForLang.value, LANG_MAP[editingLang.value].code, langEditForm.name, langEditForm.description);
      MessagePlugin.success('语言信息保存成功');
    }
    langEditVisible.value = false;
    await fetchGiftList();
    
    if (langConfigVisible.value) {
      giftLangConfig[editingLang.value] = { ...langEditForm };
    }
  } catch (error: any) {
    MessagePlugin.error(`保存失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  }
};

// 清除单个语言配置
const handleLangClear = async (giftId: string, lang: LangKey) => {
  try {
    await delGiftLanguage(giftId, LANG_MAP[lang].code);
    MessagePlugin.success('语言配置已清除');
    giftLangConfig[lang] = { name: '', description: '' };
    await fetchGiftList();
  } catch (error: any) {
    MessagePlugin.error(`清除失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  }
};

// 打开类别编辑弹窗
const openCategoryEditDialog = async (item: GiftItem) => {
  editingCategoryGift.value = item;

  const categories = categoryList.value.map((cat: any) => ({
    id: String(cat.id || cat.CategoryId || ''),
    name: cat.name || cat.CategoryName || '',
    giftIds: (cat.giftIds || cat.GiftIdList || []).map(String),
  }));
  allCategories.value = categories;
  
  const currentCategoryIds = (item.categoryIds || []).map(String);
  
  if (currentCategoryIds.length === 0 && categories.length > 0) {
    const inferredIds = categories
      .filter(cat => cat.giftIds.includes(String(item.id)))
      .map(cat => cat.id);
    giftCategoryIds.value = inferredIds;
  } else {
    giftCategoryIds.value = currentCategoryIds;
  }
  
  categoryEditVisible.value = true;
};

// 打开类别删除确认弹窗
const openCategoryDeleteConfirm = (categoryId: string) => {
  deletingCategoryId.value = categoryId;
  categoryDeleteVisible.value = true;
};

// 确认移除类别
const confirmRemoveCategory = async () => {
  if (!editingCategoryGift.value || !deletingCategoryId.value) return;
  
  try {
    await delGiftCategoryRelations(deletingCategoryId.value, [editingCategoryGift.value.id]);
    giftCategoryIds.value = giftCategoryIds.value.filter(id => id !== deletingCategoryId.value);
    MessagePlugin.success('已移除类别');
    await fetchGiftList();
  } catch (error: any) {
    MessagePlugin.error(`操作失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  } finally {
    categoryDeleteVisible.value = false;
    deletingCategoryId.value = '';
  }
};

// 添加类别
const handleAddCategory = async (categoryId: string) => {
  if (!editingCategoryGift.value) return;
  
  try {
    await addGiftCategoryRelations(categoryId, [editingCategoryGift.value.id]);
    giftCategoryIds.value = [...giftCategoryIds.value, categoryId];
    categorySelectVisible.value = false;
    MessagePlugin.success('已添加类别');
    await fetchGiftList();
  } catch (error: any) {
    MessagePlugin.error(`操作失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  }
};

// 提交表单
const handleSubmit = async () => {
  if (!formData.id.trim()) {
    MessagePlugin.error('请输入礼物ID');
    return;
  }
  if (getByteLength(formData.id) > GIFT_ID_MAX_BYTES) {
    MessagePlugin.error(`礼物ID不能超过 ${GIFT_ID_MAX_BYTES} 字节`);
    return;
  }
  if (!formData.name.trim()) {
    MessagePlugin.error('请输入礼物名称');
    return;
  }
  if (getByteLength(formData.name) > GIFT_NAME_MAX_BYTES) {
    MessagePlugin.error(`礼物名称不能超过 ${GIFT_NAME_MAX_BYTES} 字节`);
    return;
  }
  // 缩略图必填校验（如果有待上传文件，则先不上传，等提交时自动上传）
  // 如果处于 URL 模式且输入框有值（但可能尚未验证通过），跳过此检查，交给后续 ensureUrlValidated 处理
  const iconInUrlModeForCheck = iconUploadRef.value?.isUrlInputMode ?? true;
  const hasUrlInput = iconInUrlModeForCheck && (iconUploadRef.value?.urlInputValue?.trim?.() || '');
  if (!hasPendingIcon.value && !formData.iconUrl.trim() && !hasUrlInput) {
    // 如果处于 URL 模式，设置输入框错误让其变红
    if (iconInUrlModeForCheck) {
      iconUploadRef.value?.setUrlError('请输入缩略图 URL');
    }
    MessagePlugin.error('请上传缩略图或输入缩略图 URL');
    return;
  }
  if (formData.description && getByteLength(formData.description) > GIFT_DESC_MAX_BYTES) {
    MessagePlugin.error(`礼物描述不能超过 ${GIFT_DESC_MAX_BYTES} 字节`);
    return;
  }
  // 等级范围校验
  if (formData.levelNum !== undefined && (formData.levelNum < GIFT_LEVEL_MIN || formData.levelNum > GIFT_LEVEL_MAX)) {
    MessagePlugin.error(`礼物等级必须在 ${GIFT_LEVEL_MIN} ~ ${GIFT_LEVEL_MAX} 之间`);
    return;
  }
  if (formData.extensionInfo.trim()) {
    try {
      JSON.parse(formData.extensionInfo.trim());
    } catch {
      MessagePlugin.error('自定义扩展信息必须为合法的 JSON 格式');
      return;
    }
    if (getByteLength(formData.extensionInfo.trim()) > 100) {
      MessagePlugin.error('自定义扩展信息不能超过 100 字节');
      return;
    }
  }

  submitting.value = true;

  try {
    // 并行解析缩略图和素材 URL（公共逻辑自动处理 URL 验证 / 文件上传 / fallback）
    let iconUrl: string;
    let animationUrl: string;
    try {
      [iconUrl, animationUrl] = await resolveMultipleImageUploads([
        {
          handle: iconUploadRef.value as any,
          hasPendingFile: hasPendingIcon.value,
          fallbackUrl: formData.iconUrl,
          label: '缩略图',
        },
        {
          handle: animUploadRef.value as any,
          hasPendingFile: hasPendingAnim.value,
          fallbackUrl: formData.animationUrl,
          label: '礼物素材',
        },
      ]);
    } catch (err: any) {
      MessagePlugin.error(err instanceof ImageUploadResolveError ? err.message : `图片处理失败: ${err.message || '未知错误'}`);
      submitting.value = false;
      return;
    }

    if (isEdit.value) {
      await updateGift(editingId.value, {
        name: formData.name,
        iconUrl,
        price: formData.price,
        animationUrl,
        level: formData.levelNum,
        description: formData.description,
        extensionInfo: formData.extensionInfo.trim() || undefined,
      });
    } else {
      await createGift({
        id: formData.id,
        name: formData.name,
        iconUrl,
        price: formData.price,
        animationUrl,
        enabled: formData.enabled,
        level: formData.levelNum,
        description: formData.description,
        extensionInfo: formData.extensionInfo.trim() || undefined,
      });
    }

    MessagePlugin.success(isEdit.value ? '礼物更新成功' : '礼物创建成功');
    await fetchGiftList();
    dialogVisible.value = false;
  } catch (error: any) {
    MessagePlugin.error(`操作失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  } finally {
    submitting.value = false;
  }
};

// 删除礼物
const handleDelete = (row: GiftItem) => {
  deletingItem.value = row;
  deleteDialogVisible.value = true;
};

const confirmDelete = async () => {
  if (!deletingItem.value) return;
  
  try {
    await deleteGift(deletingItem.value.id);
    MessagePlugin.success('礼物已删除');
    await fetchGiftList();
  } catch (error: any) {
    MessagePlugin.error(`删除失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  } finally {
    deleteDialogVisible.value = false;
    deletingItem.value = null;
  }
};

// 获取礼物列表
const fetchGiftList = async () => {
  loading.value = true;

  try {
    const result = await getGiftList();
    giftList.value = result.gifts;
    displayList.value = result.gifts;
    if (result.categories && result.categories.length > 0) {
      categoryList.value = result.categories;
    }
  } catch (error: any) {
    console.error('获取礼物列表失败:', error);
    MessagePlugin.error(`获取礼物列表失败: ${error.ErrorInfo || error.message || '网络错误'}`);
    giftList.value = [];
    displayList.value = [];
  } finally {
    loading.value = false;
  }
};

// 搜索礼物：本地模糊匹配（ID、名称、描述、类别）
const handleSearch = async () => {
  const input = searchInput.value.trim().toLowerCase();
  if (!input) {
    return;
  }
  if (getByteLength(searchInput.value) > GIFT_SEARCH_MAX_BYTES) {
    MessagePlugin.error('输入内容太长');
    return;
  }

  const localResults = giftList.value.filter(gift => {
    const id = (gift.id || '').toLowerCase();
    const name = (gift.name || '').toLowerCase();
    const description = (gift.description || '').toLowerCase();
    const categories = (gift.categories || []).join(',').toLowerCase();
    return id.includes(input) || name.includes(input) || description.includes(input) || categories.includes(input);
  });

  if (localResults.length > 0) {
    displayList.value = localResults;
    MessagePlugin.success(`找到 ${localResults.length} 个匹配结果`);
  } else {
    displayList.value = [];
    MessagePlugin.error(`未找到与"${searchInput.value.trim()}"相关的礼物`);
  }
};

// 清除搜索（仅清空输入，恢复完整列表）
const handleClearSearch = () => {
  searchInput.value = '';
  displayList.value = giftList.value;
};

// 输入变化时实时过滤
const handleSearchInputChange = (value: string) => {
  searchInput.value = String(value ?? '');
  if (getByteLength(searchInput.value) > GIFT_SEARCH_MAX_BYTES) {
    return;
  }

  const input = searchInput.value.trim().toLowerCase();
  if (!input) {
    displayList.value = giftList.value;
    return;
  }
  displayList.value = giftList.value.filter(gift => {
    const id = (gift.id || '').toLowerCase();
    const name = (gift.name || '').toLowerCase();
    const description = (gift.description || '').toLowerCase();
    const categories = (gift.categories || []).join(',').toLowerCase();
    return id.includes(input) || name.includes(input) || description.includes(input) || categories.includes(input);
  });
};

// 初始化
let fetching = false;
onMounted(async () => {
  if (fetching) return;
  fetching = true;

  // 获取上传配置
  try {
    const config = await getUploadConfig();
    uploadEnabled.value = config.enabled;
  } catch {
    // ignore
  }

  await fetchGiftList();
});
</script>
