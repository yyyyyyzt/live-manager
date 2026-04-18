// Aegis 性能监控
export { initAegis, getAegis, setAegisUin, updateUinFromSdkAppId, enableAutoUpdateUin, disableAutoUpdateUin, isAegisInited, Aegis } from './aegis';
export type { AegisConfig } from './aegis';

// HTTP 客户端（需各前端项目初始化）
export { initHttpClient, getHttpClient, request, get, post, put, del } from './client';

// TRTC 客户端
export { TRTCApi, trtcRequest, checkTRTCResponse, getStreamInfoAsync } from './trtc-client';
export type { TRTCResponse } from './trtc-client';

// 业务 API
export * from './auth';
export * from './room';
export * from './chat';
export * from './gift';
export * from './upload';

// 类型
export * from './types';

// 工具函数
export { safelyParse, createDebounce, setFullScreen, exitFullScreen, copyText, BASIC_EMOJI, EMOJI_BASE_URL, parseTextWithEmoji } from './utils';
export type { EmojiSegment } from './utils';

// ImageUpload 共享逻辑
export {
  // 纯工具函数
  isVideoUrl, isSvgaUrl, isSvgaFile, isVideoFile, readFileAsDataURL,
  // SVGA 相关
  initSvgaParser, getSvgaParserIfInited, validateSvgaUrl, validateSvgaFile,
  // 媒体验证
  validateImageUrl, validateImageFile, validateVideoFile,
  // 文件选择验证
  validateFileType, validateFileSize, validateFileLoad,
  // URL 验证控制器
  UrlValidationController,
} from './utils/image-upload';
export type { UrlValidationCallbacks, FileTypeValidationResult } from './utils/image-upload';

// ImageUpload 提交解析（Modal 层公共逻辑）
export {
  resolveImageUploadUrl,
  resolveMultipleImageUploads,
  getUploadErrorMessage,
  ImageUploadResolveError,
} from './utils/image-upload-resolve';
export type {
  ImageUploadHandle,
  ResolveImageUploadOptions,
  ResolveImageUploadResult,
} from './utils/image-upload-resolve';

// 错误码友好信息
export { getErrorMessage, isSuccess, isClientError, isRestApiError, isServerError, getErrorCategory } from './utils/error-message';
export type { ErrorCategory } from './utils/error-message';

// 主播头像/名称解析
export { getFallbackInitial, resolveAnchorAvatarUrl, resolveAnchorDisplayName } from './utils/anchor';

// 配置
export { getBasicInfo, DIALOG_WIDTH, defaultCoverUrl, defaultAvatarUrl } from './config';

// URL 参数覆盖
export {
  getUrlOverrideParams,
  isUrlOverrideMode,
  createAccountFromUrlOverride,
  getUrlOverrideQuery,
  appendOverrideToPath,
  clearCache,
  setServerConfigured,
  isServerConfigured,
} from './url-override';
export type { UrlOverrideParams } from './url-override';

// 国际化资源
export { zhResource, enResource } from './i18n';

// 组件公共资源（类型与 ./types 中 GiftItem / CategoryLanguageDetail 同名，此处显式导出避免重复）
export type {
  LangKey,
  LangInfo,
  LangMap,
  GiftTableColumn,
  GiftTableProps,
  LangEditForm,
  GiftLangConfig,
} from './components/gift-table';
export {
  LANG_MAP,
  LANG_CODE_TO_KEY,
  LANG_CONFIG_KEYS,
  GIFT_ID_MAX_BYTES,
  GIFT_NAME_MAX_BYTES,
  GIFT_DESC_MAX_BYTES,
  GIFT_EXT_MAX_BYTES,
  GIFT_SEARCH_MAX_BYTES,
  ROOM_SEARCH_MAX_BYTES,
} from './components/gift-table';
export {
  getByteLength,
  truncateToMaxBytes,
  formatTime,
  getLangInfo,
  getLangKeyByCode,
  getLangLabel,
  getLangCode,
} from './components/gift-table';

export type { CategoryItem, CategoryLangConfig } from './components/category-table';
export {
  MAX_CATEGORY_COUNT,
  CATEGORY_ID_MAX_BYTES,
  CATEGORY_NAME_MAX_BYTES,
  CATEGORY_DESC_MAX_BYTES,
  convertGiftCategoriesToCategoryItems,
} from './components/category-table';
// 注意：user-action-dropdown 组件需要分别在 Vue 和 React 项目中单独导入使用
// Vue: import { UserActionDropdown } from '@live-manager/common/components/user-action-dropdown/UserActionDropdown.vue'
// React: import UserActionDropdown from '@live-manager/common/components/user-action-dropdown/UserActionDropdown'

// 样式资源
import './style/room-list.css';
import './style/message-list.css';
import './style/login.css';
import './style/config-warning.css';
