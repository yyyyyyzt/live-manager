/**
 * ImageUpload 共享工具函数与 URL 验证控制器
 *
 * 这个模块将 Vue3 和 React 版本的 ImageUpload 组件中完全相同的业务逻辑
 * 抽取为框架无关的纯函数和控制器类，确保两端行为一致。
 */

import type { Parser as SVGAParser } from 'svgaplayerweb';

// ==================== 类型定义 ====================

/** URL 验证控制器的回调 */
export interface UrlValidationCallbacks {
  /** 设置验证中状态 */
  setValidating: (v: boolean) => void;
  /** 设置验证错误信息（空字符串表示无错误） */
  setError: (msg: string) => void;
  /** 验证成功后通知外部更新 URL */
  onConfirm: (url: string) => void;
}

/** 文件类型验证结果 */
export interface FileTypeValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 错误提示（仅当 valid 为 false） */
  errorHint?: string;
}

// ==================== 纯工具函数 ====================

/** 判断 URL 是否为视频文件 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

/** 判断 URL 是否为 SVGA 文件 */
export function isSvgaUrl(url: string): boolean {
  return /\.svga(\?|$)/i.test(url);
}

/** 判断文件是否为 SVGA（通过文件名后缀） */
export function isSvgaFile(file: File | Blob): boolean {
  if (file instanceof File) {
    return file.name.toLowerCase().endsWith('.svga');
  }
  return false;
}

/** 判断文件是否为视频（通过 MIME 类型） */
export function isVideoFile(file: File | Blob): boolean {
  return file.type.startsWith('video/');
}

/** 获取字符串的 UTF-8 字节长度 */
export function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/** 读取文件为 DataURL */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== SVGA 相关 ====================

/** 共享的 SVGA Parser 实例（惰性创建） */
let sharedSvgaParser: InstanceType<typeof SVGAParser> | null = null;

export function getSvgaParser(): InstanceType<typeof SVGAParser> {
  if (!sharedSvgaParser) {
    // 动态导入已在调用方完成，这里直接使用全局 parser
    // 注意：调用方必须先 import SVGAParser 并通过 initSvgaParser 设置
    throw new Error('SVGAParser 未初始化，请先调用 initSvgaParser()');
  }
  return sharedSvgaParser;
}

/** 初始化共享的 SVGA Parser（由各前端项目在导入 svgaplayerweb 后调用） */
export function initSvgaParser(ParserClass: new () => InstanceType<typeof SVGAParser>): void {
  if (!sharedSvgaParser) {
    sharedSvgaParser = new ParserClass();
  }
}

/** 获取 SVGA Parser（如果已初始化），否则返回 null */
export function getSvgaParserIfInited(): InstanceType<typeof SVGAParser> | null {
  return sharedSvgaParser;
}

/**
 * 验证 SVGA URL 是否可加载和解析
 */
export function validateSvgaUrl(url: string, timeout = 15000): Promise<true> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('URL 不能为空'));
      return;
    }

    const parser = getSvgaParser();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('SVGA 资源加载超时，请检查 URL 是否可访问'));
      }
    }, timeout);

    parser.load(
      url,
      () => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(true);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('SVGA 资源加载失败，请检查 URL 是否正确'));
        }
      },
    );
  });
}

/**
 * 验证本地 SVGA 文件是否有效
 */
export function validateSvgaFile(file: File | Blob, timeout = 15000): Promise<true> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('SVGA 文件解析超时'));
      }
    }, timeout);

    const objectUrl = URL.createObjectURL(file);
    const parser = getSvgaParser();

    parser.load(
      objectUrl,
      () => {
        if (!settled) {
          settled = true;
          cleanup();
          URL.revokeObjectURL(objectUrl);
          resolve(true);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          cleanup();
          URL.revokeObjectURL(objectUrl);
          reject(new Error('SVGA 文件无效或已损坏'));
        }
      },
    );
  });
}

// ==================== 媒体验证 ====================

/**
 * 验证图片 URL 是否可访问（综合验证：图片/视频/SVGA）
 * @param url 要验证的 URL
 * @param timeout 超时时间（毫秒），默认 8000ms
 * @param skipSvgaValidation 是否跳过 SVGA 验证
 */
export function validateImageUrl(url: string, timeout = 8000, skipSvgaValidation = false): Promise<true> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('URL 不能为空'));
      return;
    }

    // 视频类型 URL 跳过图片验证
    if (isVideoUrl(url)) {
      resolve(true);
      return;
    }

    // SVGA 格式使用专门的验证
    if (isSvgaUrl(url)) {
      if (skipSvgaValidation) {
        resolve(true);
        return;
      }
      validateSvgaUrl(url, timeout > 8000 ? timeout : 15000).then(() => resolve(true)).catch(reject);
      return;
    }

    // 使用隐藏的 img 标签验证
    const img = document.createElement('img');
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      img.onload = null;
      img.onerror = null;
      img.src = '';
      if (img.parentNode) {
        img.parentNode.removeChild(img);
      }
    };

    img.onload = () => {
      cleanup();
      resolve(true);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('图片加载失败，请检查 URL 是否正确'));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('图片加载超时，请检查 URL 是否可访问'));
    }, timeout);

    img.style.display = 'none';
    document.body?.appendChild(img);
    img.src = url;
  });
}

/**
 * 验证图片文件（Blob URL）是否可正常加载
 */
export function validateImageFile(objectUrl: string, timeout = 10000): Promise<true> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      img.onload = null;
      img.onerror = null;
      img.src = '';
      if (img.parentNode) {
        img.parentNode.removeChild(img);
      }
    };

    img.onload = () => {
      cleanup();
      resolve(true);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('图片加载失败，文件可能已损坏'));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('图片加载超时'));
    }, timeout);

    img.style.display = 'none';
    document.body?.appendChild(img);
    img.src = objectUrl;
  });
}

/**
 * 验证视频文件（Blob URL）是否可正常加载
 */
export function validateVideoFile(objectUrl: string, timeout = 15000): Promise<true> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      video.onloadeddata = null;
      video.onerror = null;
      video.src = '';
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };

    video.onloadeddata = () => {
      cleanup();
      resolve(true);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('视频加载失败，文件可能已损坏'));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('视频加载超时'));
    }, timeout);

    video.style.display = 'none';
    video.muted = true;
    document.body?.appendChild(video);
    video.src = objectUrl;
    video.load();
  });
}

// ==================== 文件选择验证 ====================

/**
 * 验证文件类型是否在 accept 列表中
 * @param file 待验证的文件
 * @param accept accept 属性字符串（逗号分隔的 MIME 类型或扩展名）
 */
export function validateFileType(file: File, accept?: string): FileTypeValidationResult {
  const acceptTypes = accept ? accept.split(',').map(t => t.trim()) : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedTypes = acceptTypes.filter(t => !t.startsWith('.'));
  const allowedExtensions = acceptTypes.filter(t => t.startsWith('.')).map(t => t.toLowerCase());
  const isVideoType = acceptTypes.some(t => t.startsWith('video/'));
  const fileExtension = '.' + (file.name.split('.').pop() || '').toLowerCase();
  const isAllowed = allowedTypes.includes(file.type) || (isVideoType && file.type.startsWith('video/')) || allowedExtensions.includes(fileExtension);

  if (!isAllowed) {
    const hintTypes = acceptTypes.map(t => {
      if (t === 'image/svg+xml') return 'SVG';
      if (t === 'video/mp4') return 'MP4';
      if (t.startsWith('.')) return t.slice(1).toUpperCase();
      if (t.startsWith('image/')) return t.replace('image/', '').toUpperCase();
      return t;
    }).join('/');
    return { valid: false, errorHint: `只允许上传 ${hintTypes} 格式的文件` };
  }

  return { valid: true };
}

/**
 * 验证文件大小是否超限
 * @param file 待验证的文件
 * @param maxSizeMB 最大文件大小（MB）
 */
export function validateFileSize(file: File, maxSizeMB: number): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

/**
 * 对文件执行加载验证（图片/视频/SVGA）
 * @param file 待验证的文件
 * @param accept accept 属性字符串
 * @param skipSvgaValidation 是否跳过 SVGA 验证
 */
export async function validateFileLoad(file: File, accept?: string, skipSvgaValidation = false): Promise<void> {
  const acceptTypes = accept ? accept.split(',').map(t => t.trim()) : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExtensions = acceptTypes.filter(t => t.startsWith('.')).map(t => t.toLowerCase());
  const fileExtension = '.' + (file.name.split('.').pop() || '').toLowerCase();
  const isSvga = fileExtension === '.svga';
  const isBinaryAsset = !isSvga && allowedExtensions.includes(fileExtension) && !file.type.startsWith('image/') && !file.type.startsWith('video/');

  if (isSvga) {
    if (!skipSvgaValidation) {
      await validateSvgaFile(file);
    }
  } else if (isBinaryAsset) {
    // 其他非标准格式，跳过加载验证
  } else {
    const objectUrl = URL.createObjectURL(file);
    try {
      if (file.type.startsWith('video/')) {
        await validateVideoFile(objectUrl);
      } else {
        await validateImageFile(objectUrl);
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

// ==================== URL 验证控制器 ====================

/**
 * 框架无关的 URL 验证状态机控制器
 *
 * 封装了 URL 输入验证的所有状态管理逻辑：
 * - blur 延迟验证（150ms）
 * - 验证取消与竞态处理
 * - ensureUrlValidated 提交前验证
 * - reset 重置
 *
 * 框架层只需将状态变化通过回调桥接到各自的响应式系统。
 */
export class UrlValidationController {
  private cancelRef: (() => void) | null = null;
  private validationPromise: Promise<void> | null = null;
  private resetFlag = false;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: UrlValidationCallbacks;
  private skipSvgaValidation: boolean;

  constructor(callbacks: UrlValidationCallbacks, skipSvgaValidation = false) {
    this.callbacks = callbacks;
    this.skipSvgaValidation = skipSvgaValidation;
  }

  /** 更新回调（用于 React 中当回调闭包更新时） */
  updateCallbacks(callbacks: UrlValidationCallbacks) {
    this.callbacks = callbacks;
  }

  /** 更新 skipSvgaValidation */
  updateSkipSvgaValidation(skip: boolean) {
    this.skipSvgaValidation = skip;
  }

  /**
   * URL 确认验证（blur / enter 场景）
   *
   * 错误提示策略：
   * - 字节超限 → 通过 callbacks.setError 在输入框下方内联显示，不弹 Toast
   * - 验证失败 → 同上，通过 callbacks.setError 内联显示
   * - 验证成功 → callbacks.onConfirm 通知外部
   */
  async doUrlConfirm(urlInputValue: string, maxBytes?: number) {
    // 取消之前的验证
    if (this.cancelRef) {
      this.cancelRef();
      this.cancelRef = null;
    }

    const trimmed = (typeof urlInputValue === 'string' ? urlInputValue : String(urlInputValue)).trim();
    if (trimmed) {
      if (maxBytes && getByteLength(trimmed) > maxBytes) {
        // 字节超限：仅通过内联错误提示，不弹 Toast
        this.callbacks.setError(`URL 不能超过 ${maxBytes} 字节`);
        return;
      }

      let canceled = false;
      this.cancelRef = () => { canceled = true; };
      this.callbacks.setValidating(true);
      this.callbacks.setError('');

      const promise = (async () => {
        try {
          await validateImageUrl(trimmed, 8000, this.skipSvgaValidation);
          if (canceled) return;
          this.callbacks.onConfirm(trimmed);
        } catch (err: any) {
          if (canceled) return;
          this.callbacks.setError(err.message || '图片 URL 无效');
        } finally {
          if (!canceled) {
            this.callbacks.setValidating(false);
          }
          this.cancelRef = null;
          this.validationPromise = null;
        }
      })();

      this.validationPromise = promise;
      await promise;
    } else {
      // 空 URL 也需要通知外部
      this.callbacks.onConfirm('');
    }
  }

  /** focus 触发：清除 resetFlag */
  handleUrlFocus() {
    this.resetFlag = false;
  }

  /** blur 触发：延迟 150ms 执行 */
  handleUrlBlur(urlInputValue: string, maxBytes?: number) {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
    }
    this.blurTimer = setTimeout(() => {
      this.blurTimer = null;
      if (this.resetFlag) {
        this.resetFlag = false;
        return;
      }
      this.doUrlConfirm(urlInputValue, maxBytes);
    }, 150);
  }

  /** Enter 触发：立即执行，不延迟 */
  handleUrlEnter(urlInputValue: string, maxBytes?: number) {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    this.resetFlag = false;
    this.doUrlConfirm(urlInputValue, maxBytes);
  }

  /**
   * 确保 URL 输入已验证并返回最终 URL
   * @param urlInputValue 当前输入值
   * @param currentValue 当前已确认的值（modelValue / value prop）
   * @param maxBytes URL 最大字节数
   */
  async ensureUrlValidated(urlInputValue: string, currentValue: string, maxBytes?: number): Promise<string> {
    // 清除 blur 延迟定时器，避免 blur 的 doUrlConfirm 与本次验证产生竞态
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }

    const trimmed = urlInputValue.trim();
    if (!trimmed) return '';

    // 字节长度检查
    if (maxBytes && getByteLength(trimmed) > maxBytes) {
      throw new Error(`URL 不能超过 ${maxBytes} 字节`);
    }

    // 如果有正在进行的验证，等待它完成
    if (this.validationPromise) {
      try {
        await this.validationPromise;
      } catch {
        // 验证失败了，下面会重新验证
      }
    }

    // 如果存在验证错误或 URL 与当前值不同，需要验证
    // 注意：通过 callbacks.setError 设置的错误需要由调用方传入判断
    if (trimmed !== currentValue) {
      return await this._doValidateForSubmit(trimmed);
    }

    // URL 已验证成功且未修改
    return trimmed;
  }

  /**
   * 带错误状态检查的 ensureUrlValidated
   * @param urlInputValue 当前输入值
   * @param currentValue 当前已确认的值
   * @param hasError 当前是否有验证错误
   * @param maxBytes URL 最大字节数
   */
  async ensureUrlValidatedWithErrorCheck(
    urlInputValue: string,
    currentValue: string,
    hasError: boolean,
    maxBytes?: number,
  ): Promise<string> {
    // 清除 blur 延迟定时器
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }

    const trimmed = urlInputValue.trim();
    if (!trimmed) return '';

    if (maxBytes && getByteLength(trimmed) > maxBytes) {
      throw new Error(`URL 不能超过 ${maxBytes} 字节`);
    }

    // 等待正在进行的验证
    if (this.validationPromise) {
      try {
        await this.validationPromise;
      } catch {
        // 下面会重新验证
      }
    }

    // 有错误或 URL 改变了都需要重新验证
    if (hasError || trimmed !== currentValue) {
      return await this._doValidateForSubmit(trimmed);
    }

    return trimmed;
  }

  /**
   * 提交场景下执行验证并返回结果
   *
   * 错误提示策略：
   * - 验证失败 → 调用 callbacks.setError 让输入框变红，同时 throw Error 给 Modal 层弹 Toast
   * - 验证成功 → callbacks.onConfirm 通知外部
   */
  private async _doValidateForSubmit(trimmed: string): Promise<string> {
    // 取消之前的验证
    if (this.cancelRef) {
      this.cancelRef();
      this.cancelRef = null;
    }

    let canceled = false;
    this.cancelRef = () => { canceled = true; };
    this.callbacks.setValidating(true);
    this.callbacks.setError('');

    try {
      await validateImageUrl(trimmed, 8000, this.skipSvgaValidation);
      if (!canceled) {
        this.callbacks.onConfirm(trimmed);
        this.callbacks.setValidating(false);
      }
      return trimmed;
    } catch (err: any) {
      if (!canceled) {
        this.callbacks.setValidating(false);
        // 设置内联错误让输入框变红，提示用户哪里有问题
        this.callbacks.setError(err.message || '图片 URL 无效');
      }
      throw err;
    } finally {
      this.cancelRef = null;
      this.validationPromise = null;
    }
  }

  /** 取消正在进行的验证 */
  cancelValidation() {
    if (this.cancelRef) {
      this.cancelRef();
      this.cancelRef = null;
    }
  }

  /** 重置所有状态 */
  reset() {
    this.resetFlag = true;
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (this.cancelRef) {
      this.cancelRef();
      this.cancelRef = null;
    }
    this.validationPromise = null;
    this.callbacks.setValidating(false);
  }

  /** 清理资源（组件卸载时调用） */
  dispose() {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (this.cancelRef) {
      this.cancelRef();
      this.cancelRef = null;
    }
  }
}
