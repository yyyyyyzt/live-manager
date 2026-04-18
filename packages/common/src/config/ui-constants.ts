import defaultCoverImage from '../assets/default-cover.png';

// ========== 默认资源 URL ==========

/** 默认封面图 URL（优先读环境变量，fallback 到本地图片） */
export const defaultCoverUrl: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_COVER_URL) || defaultCoverImage;

/** 默认头像 URL（优先读环境变量，fallback 到固定网络地址） */
export const defaultAvatarUrl: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_AVATAR_URL) ||
  'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_16.png';

// ========== 弹框宽度 ==========

/**
 * 弹框宽度常量 - React 和 Vue 统一使用
 * TDesign Dialog 的 width prop 会直接设为 inline style，
 * 因此通过 JS 常量来保持两端一致。
 */
export const DIALOG_WIDTH = {
  /** 常规表单弹框（新建/编辑直播间等） */
  FORM: 560,
  /** 信息展示弹框（房间信息、OBS 等） */
  INFO: 560,
  /** 确认类弹框（关播确认等） */
  CONFIRM: 480,
  /** 宽弹框（禁言列表、封禁列表等） */
  WIDE: 600,
  /** 裁剪图片弹窗 */
  CROP: 600,
  /** 新建/编辑礼物弹框 */
  GIFT_FORM: 600,
  /** 礼物/类别多语言配置弹框 */
  GIFT_LANG_CONFIG: 680,
  /** 礼物/类别语言编辑、类别编辑弹框 */
  GIFT_EDIT: 420,
  /** 礼物/类别删除确认弹框 */
  GIFT_DELETE: 400,
  /** 新增/编辑类别弹框 */
  CATEGORY_FORM: 500,
} as const;
