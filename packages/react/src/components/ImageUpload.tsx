import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import {
  UploadIcon,
  CloseIcon,
  CutIcon,
  ImageIcon,
} from 'tdesign-icons-react';
import { Button, Dialog, Input } from 'tdesign-react';
import {
  DIALOG_WIDTH,
  isVideoUrl, isSvgaUrl, isSvgaFile,
  getByteLength, readFileAsDataURL,
  initSvgaParser, getSvgaParserIfInited,
  validateImageUrl, validateImageFile, validateVideoFile, validateSvgaFile,
  validateFileType, validateFileSize, validateFileLoad,
  UrlValidationController,
} from '@live-manager/common';
import { Player as SVGAPlayer, Parser as SVGAParser } from 'svgaplayerweb';
import { uploadImage } from '../api/upload';
import { Message } from './Toast';
import './ImageUpload.css';

// 初始化共享的 SVGA Parser
initSvgaParser(SVGAParser);

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  type?: 'cover' | 'gift-icon' | 'gift-animation';
  /** 是否启用裁剪 */
  cropEnabled?: boolean;
  /** 裁剪宽高比 */
  aspectRatio?: number;
  /** 最大文件大小(MB) */
  maxSize?: number;
  /** 占位提示 */
  placeholder?: string;
  /** 是否显示 URL 输入框作为备选 */
  showUrlInput?: boolean;
  /** 预览尺寸 */
  previewWidth?: number;
  previewHeight?: number;
  /** COS 上传是否启用 */
  uploadEnabled?: boolean;
  /** 自定义 accept 类型 */
  accept?: string;
  /** 自定义格式提示文案 */
  acceptHint?: string;
  /** URL 最大字节数限制 */
  maxBytes?: number;
  /** 类名 */
  className?: string;
  /**
   * 延迟上传模式：选图/裁剪后不立即上传，而是通过 onFileReady 返回待上传文件，
   * 本地预览图片。外部可在合适时机调用 uploadPendingFile() 完成上传。
   */
  deferUpload?: boolean;
  /** 延迟上传模式下，文件准备就绪的回调 */
  onFileReady?: (file: File | Blob | null) => void;
  /** 是否跳过 SVGA 文件的加载验证 */
  skipSvgaValidation?: boolean;
  /** URL 错误状态变化回调（当有错误时传 true，恢复正常时传 false） */
  onUrlErrorChange?: (hasError: boolean) => void;
}

/** ImageUpload 对外暴露的方法（通过 ref） */
export interface ImageUploadRef {
  /** 执行上传暂存的文件，返回上传后的 URL */
  uploadPendingFile: () => Promise<string | null>;
  /** 当前是否处于 URL 输入模式（true=URL输入, false=文件上传） */
  isUrlInputMode: boolean;
  /** 验证图片 URL 是否可访问 */
  validateImageUrl: (url: string, timeout?: number) => Promise<true>;
  /** 当前是否正在验证 URL */
  isValidating: boolean;
  /** URL 验证错误信息 */
  urlValidationError: string;
  /** 当前 URL 是否存在错误（验证失败或字节超限） */
  hasUrlError: boolean;
  /** 当前 URL 输入框中的值 */
  urlInputValue: string;
  /** 重置组件内部状态，清理待上传文件、本地预览和 URL 输入 */
  reset: () => void;
  /** 切换到 URL 输入模式 */
  switchToUrlMode: () => void;
  /** 外部设置 URL 验证错误信息（用于必填校验等场景使输入框变红） */
  setUrlError: (msg: string) => void;
  /**
   * 确保 URL 输入已验证并返回最终 URL。
   * - 如果当前不在 URL 输入模式，返回 null
   * - 如果正在验证，等待验证完成
   * - 如果输入框中有未 blur 确认的 URL，主动触发验证
   * - 验证成功返回 URL，验证失败抛出错误
   */
  ensureUrlValidated: () => Promise<string | null>;
}

/**
 * 将裁剪区域应用到图片，返回裁剪后的 Blob
 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob failed'));
      },
      'image/jpeg',
      0.92,
    );
  });
}


const ImageUpload = forwardRef<ImageUploadRef, ImageUploadProps>(function ImageUpload({
  value = '',
  onChange,
  type = 'cover',
  cropEnabled = true,
  aspectRatio = 16 / 9,
  maxSize = 10,
  placeholder = '点击或拖拽上传图片',
  showUrlInput = true,
  previewWidth,
  previewHeight,
  uploadEnabled = false,
  accept,
  acceptHint,
  maxBytes,
  className = '',
  deferUpload = false,
  onFileReady,
  skipSvgaValidation = false,
  onUrlErrorChange,
}, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [provider, setProvider] = useState('');
  const [urlInputMode, setUrlInputMode] = useState(!uploadEnabled);
  const [urlInputValue, setUrlInputValue] = useState(value);
  const [urlValidating, setUrlValidating] = useState(false);
  const [urlValidationError, setUrlValidationError] = useState('');

  // URL 验证控制器（共享逻辑）
  const urlValidationCtrlRef = useRef<UrlValidationController | null>(null);
  if (!urlValidationCtrlRef.current) {
    urlValidationCtrlRef.current = new UrlValidationController({
      setValidating: setUrlValidating,
      setError: setUrlValidationError,
      onConfirm: onChange,
    }, skipSvgaValidation);
  }
  // 每次渲染更新回调（因为 React 闭包可能变化）
  urlValidationCtrlRef.current.updateCallbacks({
    setValidating: setUrlValidating,
    setError: setUrlValidationError,
    onConfirm: onChange,
  });
  urlValidationCtrlRef.current.updateSkipSvgaValidation(skipSvgaValidation);

  // 延迟上传模式：暂存待上传的文件和本地预览 URL
  const deferredFileRef = useRef<File | Blob | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('');
  // 记录本地预览是否为视频（用于正确渲染 video 元素）
  const [previewIsVideo, setPreviewIsVideo] = useState(false);
  // 记录本地预览是否为 SVGA（用于正确渲染 SVGA 播放器）
  const [previewIsSvga, setPreviewIsSvga] = useState(false);
  // SVGA 播放器容器 ref
  const svgaPreviewRef = useRef<HTMLDivElement>(null);
  const svgaPlayerRef = useRef<InstanceType<typeof SVGAPlayer> | null>(null);

  // 暴露 uploadPendingFile 方法和 isUrlInputMode 属性给外部
  useImperativeHandle(ref, () => ({
    get isUrlInputMode() {
      return urlInputMode;
    },
    get isValidating() {
      return urlValidating;
    },
    get urlValidationError() {
      return urlValidationError;
    },
    /** 当前 URL 是否存在错误（验证失败或字节超限），用于外部禁用提交按钮 */
    get hasUrlError() {
      if (!urlInputMode) return false;
      if (urlValidationError) return true;
      if (maxBytes && urlInputValue.trim() && getByteLength(urlInputValue.trim()) > maxBytes) return true;
      return false;
    },
    get urlInputValue() {
      return urlInputValue;
    },
    /** 切换到 URL 输入模式 */
    switchToUrlMode: () => {
      setUrlInputMode(true);
    },
    /** 外部设置 URL 验证错误信息（用于必填校验等场景使输入框变红） */
    setUrlError: (msg: string) => {
      setUrlValidationError(msg);
    },
    validateImageUrl: async (url: string, timeout?: number) => {
      setUrlValidating(true);
      setUrlValidationError('');
      try {
        await validateImageUrl(url, timeout, skipSvgaValidation);
        return true;
      } catch (err: any) {
        setUrlValidationError(err.message || '图片 URL 无效');
        throw err;
      } finally {
        setUrlValidating(false);
      }
    },
    reset: () => {
      const ctrl = urlValidationCtrlRef.current!;
      ctrl.reset();
      deferredFileRef.current = null;
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl('');
      setPreviewIsVideo(false);
      setPreviewIsSvga(false);
      // 清理 SVGA 播放器
      if (svgaPlayerRef.current) {
        try { svgaPlayerRef.current.stopAnimation(); svgaPlayerRef.current.clear(); } catch { /* ignore */ }
        svgaPlayerRef.current = null;
      }
      setUrlInputValue(value || '');
      setProvider('');
      setUrlValidationError('');
      setUploading(false);
      setUploadProgress(0);
      setUploadFailed(false);
      if (uploadEnabled) {
        setUrlInputMode(!!value);
      }
      onFileReady?.(null);
    },
    ensureUrlValidated: async () => {
      if (!urlInputMode) return null;
      const ctrl = urlValidationCtrlRef.current!;
      return await ctrl.ensureUrlValidatedWithErrorCheck(
        urlInputValue,
        value || '',
        !!urlValidationError,
        maxBytes,
      );
    },
    uploadPendingFile: async () => {
      const file = deferredFileRef.current;
      if (!file) return null;
      setUploading(true);
      setUploadProgress(0);
      setUploadFailed(false);
      try {
        const result = await uploadImage(file, type, setUploadProgress);
        deferredFileRef.current = null;
        setProvider(result.provider || '');
        setUploadFailed(false);
        return result.url;
      } catch (error: any) {
        setUploadFailed(true);
        throw error;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
  }), [type, urlInputMode, urlValidating, urlValidationError, urlInputValue, localPreviewUrl, value, maxBytes, onChange]);

  // 同步外部 value prop 到本地状态
  useEffect(() => {
    setUrlInputValue(value);
    // 如果有值（URL），自动切换到 URL 模式
    if (value && uploadEnabled) {
      setUrlInputMode(true);
    }
    // 当 value 变化时，清理延迟上传相关的本地状态，避免显示上次的缓存
    // 注意：无论 value 是空字符串还是新值，都需要清理，因为用户可能清空了 URL
    if (deferUpload) {
      deferredFileRef.current = null;
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl('');
      setPreviewIsSvga(false);
      // 清理 SVGA 播放器
      if (svgaPlayerRef.current) {
        try { svgaPlayerRef.current.stopAnimation(); svgaPlayerRef.current.clear(); } catch { /* ignore */ }
        svgaPlayerRef.current = null;
      }
      onFileReady?.(null);
    }
  }, [value]);

  // 监听 uploadEnabled 变化，当变为 true 且有 value 时，保持 URL 模式
  // 没有 URL 时才切换到上传模式
  useEffect(() => {
    if (uploadEnabled && value) {
      setUrlInputMode(true);
    } else if (uploadEnabled) {
      setUrlInputMode(false);
    }
  }, [uploadEnabled]);

  // 监听 URL 错误状态变化，通知父组件（用于禁用提交按钮）
  useEffect(() => {
    if (!onUrlErrorChange) return;
    let hasError = false;
    if (urlInputMode || !uploadEnabled) {
      if (urlValidationError) hasError = true;
      else if (maxBytes && urlInputValue.trim() && getByteLength(urlInputValue.trim()) > maxBytes) hasError = true;
    }
    onUrlErrorChange(hasError);
  }, [urlInputMode, urlValidationError, urlInputValue, maxBytes, uploadEnabled, onUrlErrorChange]);

  // 当外部 value 被设置为远程 URL 后，清理本地预览 ObjectURL（避免内存泄漏）
  useEffect(() => {
    if (value && localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl('');
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // 组件卸载时清理控制器和 SVGA 播放器
  useEffect(() => {
    return () => {
      urlValidationCtrlRef.current?.dispose();
      // 清理 SVGA 播放器
      if (svgaPlayerRef.current) {
        try { svgaPlayerRef.current.stopAnimation(); svgaPlayerRef.current.clear(); } catch { /* ignore */ }
        svgaPlayerRef.current = null;
      }
    };
  }, []);

  // SVGA 预览播放器初始化：当 localPreviewUrl 指向 SVGA 文件时，用 svgaplayerweb 播放
  useEffect(() => {
    if (!previewIsSvga || !localPreviewUrl || !svgaPreviewRef.current) {
      return;
    }
    // 清理旧播放器
    if (svgaPlayerRef.current) {
      try { svgaPlayerRef.current.stopAnimation(); svgaPlayerRef.current.clear(); } catch { /* ignore */ }
      svgaPlayerRef.current = null;
    }

    const container = svgaPreviewRef.current;
    const player = new SVGAPlayer(container);
    player.loops = 0; // 循环播放（预览）
    player.setContentMode('AspectFit');
    svgaPlayerRef.current = player;

    const parser = getSvgaParserIfInited();
    if (!parser) return;
    parser.load(
      localPreviewUrl,
      (videoItem) => {
        player.setVideoItem(videoItem);
        player.startAnimation();
      },
      (error) => {
        console.error('[ImageUpload] SVGA preview load error:', error);
      },
    );

    return () => {
      try { player.stopAnimation(); player.clear(); } catch { /* ignore */ }
      svgaPlayerRef.current = null;
    };
  }, [previewIsSvga, localPreviewUrl]);

  // SVGA URL 预览播放器：当 value 指向 SVGA URL（URL 模式下）
  const svgaUrlPreviewRef = useRef<HTMLDivElement>(null);
  const svgaUrlPlayerRef = useRef<InstanceType<typeof SVGAPlayer> | null>(null);

  useEffect(() => {
    if (!value || !isSvgaUrl(value) || !(urlInputMode || !uploadEnabled) || !svgaUrlPreviewRef.current) {
      // 清理旧的 URL 模式 SVGA 播放器
      if (svgaUrlPlayerRef.current) {
        try { svgaUrlPlayerRef.current.stopAnimation(); svgaUrlPlayerRef.current.clear(); } catch { /* ignore */ }
        svgaUrlPlayerRef.current = null;
      }
      return;
    }
    // 清理旧播放器
    if (svgaUrlPlayerRef.current) {
      try { svgaUrlPlayerRef.current.stopAnimation(); svgaUrlPlayerRef.current.clear(); } catch { /* ignore */ }
      svgaUrlPlayerRef.current = null;
    }

    const container = svgaUrlPreviewRef.current;
    const player = new SVGAPlayer(container);
    player.loops = 0;
    player.setContentMode('AspectFit');
    svgaUrlPlayerRef.current = player;

    const parser = getSvgaParserIfInited();
    if (!parser) return;
    parser.load(
      value,
      (videoItem) => {
        player.setVideoItem(videoItem);
        player.startAnimation();
      },
      (error) => {
        console.error('[ImageUpload] SVGA URL preview load error:', error);
      },
    );

    return () => {
      try { player.stopAnimation(); player.clear(); } catch { /* ignore */ }
      svgaUrlPlayerRef.current = null;
    };
  }, [value, urlInputMode, uploadEnabled]);

  // 裁剪状态
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // TDesign Dialog 使用 CSSTransition 的 zoom (transform: scale) 入场动画，
  // 动画期间 Cropper 内部通过 getBoundingClientRect() 获取的容器尺寸是经过 scale 缩小的，
  // 导致裁剪框（虚线框）计算出非常小的尺寸。
  // 解决方案：延迟渲染 Cropper，等 Dialog 动画完成后再挂载，确保布局稳定。
  const [cropperReady, setCropperReady] = useState(false);
  const cropperReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (cropperReadyTimerRef.current) {
        clearTimeout(cropperReadyTimerRef.current);
      }
    };
  }, []);

  // 处理文件选择
  const handleFileSelect = async (file: File) => {
    // 验证文件类型
    const typeResult = validateFileType(file, accept);
    if (!typeResult.valid) {
      Message.error(typeResult.errorHint!);
      return;
    }

    if (!validateFileSize(file, maxSize)) {
      Message.error(`文件大小不能超过 ${maxSize}MB`);
      return;
    }

    // 实际加载验证
    try {
      await validateFileLoad(file, accept, skipSvgaValidation);
    } catch (err: any) {
      Message.error(err.message || '文件加载失败，请检查文件是否完整');
      return;
    }

    if (cropEnabled) {
      // 先重置状态并弹出对话框，避免大图片加载阻塞交互
      setCropImageSrc('');
      setPendingFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setImageLoading(true);
      setCropperReady(false); // 延迟渲染 Cropper，等动画结束
      setCropModalVisible(true);

      // 异步加载图片
      try {
        const dataUrl = await readFileAsDataURL(file);
        setCropImageSrc(dataUrl);
      } catch (error) {
        Message.error('图片加载失败，请重试');
        setCropModalVisible(false);
      } finally {
        setImageLoading(false);
        // 延迟设置 cropperReady，确保 Dialog 的 zoom 入场动画（~300ms）完成后再渲染 Cropper
        if (cropperReadyTimerRef.current) {
          clearTimeout(cropperReadyTimerRef.current);
        }
        cropperReadyTimerRef.current = setTimeout(() => {
          setCropperReady(true);
        }, 350);
      }
    } else {
      await doUpload(file);
    }
  };

  // 执行上传（或在 deferUpload 模式下暂存文件）
  const doUpload = async (fileOrBlob: File | Blob) => {
    if (deferUpload) {
      // 延迟上传模式：暂存文件，生成本地预览
      deferredFileRef.current = fileOrBlob;
      const previewUrl = URL.createObjectURL(fileOrBlob);
      // 清理旧的预览 URL
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl(previewUrl);
      // 根据文件类型设置预览类型
      const isVideo = fileOrBlob.type.startsWith('video/');
      const svga = isSvgaFile(fileOrBlob);
      setPreviewIsVideo(isVideo);
      setPreviewIsSvga(svga);
      // 通知外部文件已就绪
      onFileReady?.(fileOrBlob);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadImage(fileOrBlob, type, setUploadProgress);
      onChange(result.url);
      setProvider(result.provider || '');
      Message.success('上传成功');
    } catch (error: any) {
      Message.error(`上传失败: ${error.message || '网络错误'}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 裁剪确认
  const handleCropConfirm = async () => {
    if (!croppedAreaPixels || !cropImageSrc) return;

    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      setCropModalVisible(false);
      await doUpload(croppedBlob);
    } catch (error: any) {
      Message.error('裁剪失败，请重试');
    }
  };

  // 跳过裁剪，直接上传原图
  const handleSkipCrop = async () => {
    if (!pendingFile) return;
    setCropModalVisible(false);
    await doUpload(pendingFile);
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // URL 输入确认（委托给控制器）
  const doUrlConfirm = async () => {
    await urlValidationCtrlRef.current!.doUrlConfirm(
      urlInputValue,
      maxBytes,
    );
  };

  // focus 触发
  const handleUrlFocus = () => {
    urlValidationCtrlRef.current!.handleUrlFocus();
  };

  // blur 触发
  const handleUrlBlur = () => {
    urlValidationCtrlRef.current!.handleUrlBlur(
      urlInputValue,
      maxBytes,
    );
  };

  // Enter 触发
  const handleUrlEnter = () => {
    urlValidationCtrlRef.current!.handleUrlEnter(
      urlInputValue,
      maxBytes,
    );
  };

  // 清除已上传的图片
  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    urlValidationCtrlRef.current!.cancelValidation();
    setUrlValidating(false);
    setUrlValidationError('');
    onChange('');
    setUrlInputValue('');
    setProvider('');
    setUploading(false);
    setUploadProgress(0);
    setUploadFailed(false);
    // 清理 SVGA 播放器
    if (svgaPlayerRef.current) {
      try { svgaPlayerRef.current.stopAnimation(); svgaPlayerRef.current.clear(); } catch { /* ignore */ }
      svgaPlayerRef.current = null;
    }
    if (deferUpload) {
      deferredFileRef.current = null;
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl('');
      }
      setPreviewIsVideo(false);
      setPreviewIsSvga(false);
      onFileReady?.(null);
    }
  };

  return (
    <div className={`image-upload-container ${className}`}>
      {/* 模式切换：上传 / URL 输入 */}
      {uploadEnabled && showUrlInput && (
        <div className="image-upload-mode-switch">
          <Button
            shape="round"
            variant="outline"
            className={`mode-switch-btn ${!urlInputMode ? 'active' : ''}`}
            onClick={() => {
              // 切换到上传模式前取消 URL 验证
              urlValidationCtrlRef.current!.cancelValidation();
              setUrlValidating(false);
              setUrlValidationError('');
              setUrlInputMode(false);
            }}
            icon={<UploadIcon size={12} />}
          >
            上传图片
          </Button>
          <Button
            shape="round"
            variant="outline"
            className={`mode-switch-btn ${urlInputMode ? 'active' : ''}`}
            onClick={() => {
              // 切换到 URL 模式前取消任何正在进行的验证
              urlValidationCtrlRef.current!.cancelValidation();
              setUrlValidating(false);
              setUrlValidationError('');
              setUrlInputMode(true);
            }}
          >
            输入URL
          </Button>
        </div>
      )}

      {/* URL 输入模式 */}
      {(urlInputMode || !uploadEnabled) && (
        <div className="image-upload-url-input">
          <Input
            value={urlInputValue}
            onChange={(value) => { setUrlInputValue(String(value)); setUrlValidationError(''); urlValidationCtrlRef.current!.cancelValidation(); setUrlValidating(false); }}
            onFocus={handleUrlFocus}
            onBlur={handleUrlBlur}
            onEnter={handleUrlEnter}
            placeholder="请输入图片URL"
            status={urlValidationError ? 'error' : undefined}
            suffix={maxBytes ? (
              urlValidating ? (
                <span className="input-suffix-validating">验证中...</span>
              ) : (
                <span className={`input-suffix-count${getByteLength(urlInputValue) > maxBytes ? ' byte-overflow' : ''}`}>
                  {getByteLength(urlInputValue)}/{maxBytes}
                </span>
              )
            ) : undefined}
          />
        </div>
      )}
      {urlValidationError && (urlInputMode || !uploadEnabled) && (
        <div className="image-upload-url-error">{urlValidationError}</div>
      )}

      {/* 上传模式 */}
      {uploadEnabled && !urlInputMode && (
        <>
          {/* 已有上传的图片 - 显示预览（只显示上传文件的预览，不显示 URL 的预览） */}
          {localPreviewUrl ? (
            <div
              className="image-upload-preview"
              style={{
                width: previewWidth || '100%',
                height: previewHeight || 160,
              }}
            >
              {uploading ? (
                // 正在上传时显示进度条覆盖层
                <div className="image-upload-uploading-overlay">
                  <div className="image-upload-progress-circle">
                    <svg viewBox="0 0 36 36" className="progress-ring">
                      <path
                        className="progress-ring-bg"
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="progress-ring-fill"
                        strokeDasharray={`${uploadProgress}, 100`}
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="progress-percent">{uploadProgress}%</span>
                  </div>
                  <span className="upload-status-text">上传中...</span>
                </div>
              ) : (
                <>
                  {previewIsSvga ? (
                    <div ref={svgaPreviewRef} className="svga-preview-container" />
                  ) : previewIsVideo ? (
                    <video src={localPreviewUrl} muted loop autoPlay playsInline />
                  ) : (
                    <img src={localPreviewUrl} alt="preview" />
                  )}
                </>
              )}
              {!uploading && provider && (
                <span className="image-upload-provider-badge">{provider.toUpperCase()}</span>
              )}
              {!uploading && uploadFailed ? (
                <span className="image-upload-provider-badge upload-failed-badge">上传失败</span>
              ) : !uploading && !provider ? (
                <span className="image-upload-provider-badge" style={{ background: '#ff9800' }}>待上传</span>
              ) : null}
              {!uploading && (
                <div className="image-upload-preview-actions">
                  <button
                    className="preview-action-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="重新上传"
                  >
                    <UploadIcon />
                  </button>
                  <button
                    className="preview-action-btn"
                    onClick={handleClear}
                    title="删除"
                  >
                    <CloseIcon />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 上传区域 */
            <div
              className={`image-upload-dropzone ${uploading ? 'uploading' : ''}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{ height: previewHeight || 120 }}
            >
              {uploading ? (
                <div className="image-upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="progress-text">{uploadProgress}%</span>
                </div>
              ) : (
                <>
                  <ImageIcon size={32} strokeWidth={1.2} />
                  <span className="upload-hint">{placeholder}</span>
                  <span className="upload-sub-hint">{acceptHint || `支持 JPG/PNG/GIF/WebP，最大 ${maxSize}MB`}</span>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={accept || "image/jpeg,image/png,image/gif,image/webp"}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = '';
            }}
          />
        </>
      )}

      {/* 图片预览（URL 输入模式下） */}
      {value && (urlInputMode || !uploadEnabled) && (
        <div
          className="image-upload-preview url-preview"
          style={{
            width: previewWidth || '100%',
            height: previewHeight || 120,
            marginTop: 8,
          }}
        >
          {isSvgaUrl(value) ? (
            <div ref={svgaUrlPreviewRef} className="svga-preview-container" />
          ) : isVideoUrl(value) ? (
            <video src={value} muted loop autoPlay playsInline />
          ) : (
            <img src={value} alt="preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
      )}

      {/* 裁剪弹窗 */}
      <Dialog
        visible={cropModalVisible}
        header="裁剪图片"
        onClose={() => setCropModalVisible(false)}
        width={600}
        className="image-crop-modal"
        footer={
          <>
            <Button shape="round" variant="outline" onClick={() => setCropModalVisible(false)}>
              取消
            </Button>
            <Button shape="round" theme="primary" onClick={handleCropConfirm} disabled={imageLoading || !cropImageSrc} icon={<CutIcon size={14} />}>
              确认裁剪
            </Button>
          </>
        }
      >
          <div className="image-crop-area">
            {imageLoading || !cropperReady ? (
              <div className="image-crop-loading">
                <div className="loading-spinner" />
                <span>图片加载中...</span>
              </div>
            ) : cropImageSrc ? (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : null}
          </div>
      </Dialog>
    </div>
  );
});

export default ImageUpload;
