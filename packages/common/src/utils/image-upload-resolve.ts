/**
 * ImageUpload 提交时解析最终 URL 的公共逻辑
 *
 * 将 Vue3 和 React 端在 Modal 提交函数中重复出现的
 * ensureUrlValidated / uploadPendingFile / fallback 三路分支
 * 抽象为框架无关的纯函数。
 *
 * 使用方只需将 ImageUpload 的 ref handle 适配为 ImageUploadHandle 接口，
 * 然后调用 resolveImageUploadUrl 即可一行搞定。
 */

// ==================== 类型定义 ====================

/**
 * 框架无关的 ImageUpload 组件 handle 接口
 *
 * Vue3 端通过 `ref<InstanceType<typeof ImageUpload>>` 获取，
 * React 端通过 `useRef<ImageUploadRef>` 获取。
 * 两端的 ImageUpload 组件都暴露了这些方法/属性。
 */
export interface ImageUploadHandle {
  /** 当前是否处于 URL 输入模式（vs 文件上传模式） */
  isUrlInputMode: boolean;
  /** URL 输入框当前的原始值（可能尚未验证） */
  urlInputValue?: string;
  /** 确保 URL 已验证，返回验证后的 URL。验证失败会 throw Error */
  ensureUrlValidated: () => Promise<string>;
  /** 上传待上传的文件，返回上传后的 URL */
  uploadPendingFile: () => Promise<string>;
  /** 是否正在验证中 */
  isValidating: boolean;
  /** 是否有 URL 验证错误 */
  hasUrlError: boolean;
  /** 重置组件内部状态 */
  reset: () => void;
}

/** 解析单个 ImageUpload 的入参 */
export interface ResolveImageUploadOptions {
  /** ImageUpload 的 ref handle（Vue: .value, React: .current） */
  handle: ImageUploadHandle | null | undefined;
  /** 是否有待上传的文件（由 onFileReady 回调跟踪） */
  hasPendingFile: boolean;
  /** 当前表单中的 URL fallback 值（formData.coverUrl / formData.iconUrl 等） */
  fallbackUrl: string;
  /** 错误消息中的标签，如 "封面" / "缩略图" / "素材" */
  label: string;
}

/** 解析结果 */
export interface ResolveImageUploadResult {
  /** 最终可用的 URL（空字符串表示用户未提供） */
  url: string;
}

/** 解析失败时抛出的带标签错误 */
export class ImageUploadResolveError extends Error {
  /** 错误来源标签，如 "封面" / "缩略图" */
  label: string;
  /** 错误类型：url-validation 表示 URL 验证失败，upload 表示文件上传失败 */
  type: 'url-validation' | 'upload';
  /** 原始错误 */
  cause: any;

  constructor(label: string, type: 'url-validation' | 'upload', originalError: any) {
    const prefix = type === 'url-validation' ? `${label}不可用` : `${label}上传失败`;
    const detail = originalError?.ErrorInfo || originalError?.message || (type === 'url-validation' ? '请检查 URL 是否正确' : '网络错误');
    super(`${prefix}: ${detail}`);
    this.name = 'ImageUploadResolveError';
    this.label = label;
    this.type = type;
    this.cause = originalError;
  }
}

// ==================== 核心函数 ====================

/**
 * 解析单个 ImageUpload 组件的最终 URL
 *
 * 根据组件当前模式（URL 输入 / 文件上传），自动执行：
 * - URL 模式：调用 ensureUrlValidated() 验证并获取 URL
 * - 上传模式 + 有待上传文件：调用 uploadPendingFile() 上传并获取 URL
 * - 上传模式 + 无待上传文件：使用 fallbackUrl
 *
 * @returns 验证/上传后的最终 URL（空字符串表示用户未提供）
 * @throws {ImageUploadResolveError} 验证失败或上传失败时抛出
 *
 * @example
 * ```ts
 * // Vue3
 * const coverUrl = await resolveImageUploadUrl({
 *   handle: coverUploadRef.value,
 *   hasPendingFile: hasPendingCover.value,
 *   fallbackUrl: formData.value.coverUrl,
 *   label: '封面',
 * });
 *
 * // React
 * const coverUrl = await resolveImageUploadUrl({
 *   handle: coverUploadRef.current,
 *   hasPendingFile: hasPendingCover,
 *   fallbackUrl: formData.coverUrl,
 *   label: '封面',
 * });
 * ```
 */
export async function resolveImageUploadUrl(options: ResolveImageUploadOptions): Promise<string> {
  const { handle, hasPendingFile, fallbackUrl, label } = options;

  const isUrlMode = handle?.isUrlInputMode ?? true;

  if (isUrlMode) {
    // URL 输入模式：通过 ensureUrlValidated 获取验证后的 URL
    try {
      const validatedUrl = await handle?.ensureUrlValidated();
      if (validatedUrl !== null && validatedUrl !== undefined) {
        return validatedUrl;
      }
      return '';
    } catch (err: any) {
      throw new ImageUploadResolveError(label, 'url-validation', err);
    }
  } else {
    // 上传模式
    if (hasPendingFile && handle) {
      try {
        const uploadedUrl = await handle.uploadPendingFile();
        return uploadedUrl || '';
      } catch (err: any) {
        throw new ImageUploadResolveError(label, 'upload', err);
      }
    } else {
      return fallbackUrl.trim();
    }
  }
}

/**
 * 批量解析多个 ImageUpload 组件的最终 URL（并行执行）
 *
 * 用于 GiftConfig 等有多个 ImageUpload 的场景，
 * 所有 ImageUpload 的解析并行执行以提高性能。
 *
 * @returns 与输入 uploads 数组对应的 URL 数组
 * @throws {ImageUploadResolveError} 任一解析失败时立即抛出（第一个失败的错误）
 *
 * @example
 * ```ts
 * const [iconUrl, animationUrl] = await resolveMultipleImageUploads([
 *   {
 *     handle: iconUploadRef.current,
 *     hasPendingFile: hasPendingIcon,
 *     fallbackUrl: formData.iconUrl,
 *     label: '缩略图',
 *   },
 *   {
 *     handle: animUploadRef.current,
 *     hasPendingFile: hasPendingAnim,
 *     fallbackUrl: formData.animationUrl,
 *     label: '素材',
 *   },
 * ]);
 * ```
 */
export async function resolveMultipleImageUploads(
  uploads: ResolveImageUploadOptions[],
): Promise<string[]> {
  return Promise.all(uploads.map(resolveImageUploadUrl));
}

/**
 * 格式化 ImageUpload 解析错误为用户友好的消息
 *
 * @param error 任意错误对象
 * @param fallbackLabel 当 error 不是 ImageUploadResolveError 时使用的默认标签
 * @returns 用户友好的错误消息字符串
 */
export function getUploadErrorMessage(error: any, fallbackLabel = '图片'): string {
  if (error instanceof ImageUploadResolveError) {
    return error.message;
  }
  const detail = error?.ErrorInfo || error?.message || '未知错误';
  return `${fallbackLabel}处理失败: ${detail}`;
}
