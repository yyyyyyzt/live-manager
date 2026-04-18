<template>
    <div class="image-upload-container">
        <!-- 模式切换：上传 / URL 输入 -->
        <div v-if="uploadEnabled && showUrlInput" class="image-upload-mode-switch">
            <button class="mode-switch-btn" :class="{ active: !urlInputMode }" @click="switchToUploadMode">
                <UploadIcon />
                上传图片
            </button>
            <button class="mode-switch-btn" :class="{ active: urlInputMode }" @click="switchToUrlMode">
                输入URL
            </button>
        </div>

        <!-- URL 输入模式 -->
        <div v-if="urlInputMode || !uploadEnabled" class="image-upload-url-input">
            <t-input
                :model-value="urlInputValue"
                @update:model-value="handleUrlInput"
                @focus="handleUrlFocus"
                @blur="handleUrlBlur"
                @enter="handleUrlEnter"
                placeholder="请输入图片URL"
                :status="urlValidationError ? 'error' : 'default'">
                <template v-if="maxBytes" #suffix>
                    <span v-if="urlValidating" class="input-suffix-validating">验证中...</span>
                    <span v-else class="input-suffix-count" :class="{ 'byte-overflow': byteLength > maxBytes }">
                        {{ byteLength }}/{{ maxBytes }}
                    </span>
                </template>
            </t-input>
        </div>
        <div v-if="urlValidationError && (urlInputMode || !uploadEnabled)" class="image-upload-url-error">
            {{ urlValidationError }}
        </div>

        <!-- 上传模式 -->
        <template v-if="uploadEnabled && !urlInputMode">
            <!-- 已有上传的图片 - 显示预览 -->
            <!-- 只显示上传文件的预览，不显示 URL 的预览 -->
            <div v-if="localPreviewUrl" class="image-upload-preview" :style="{
                width: typeof previewWidth === 'number' ? `${previewWidth}px` : (previewWidth || '100%'),
                height: `${previewHeight || 160}px`,
            }">
                <!-- 上传中显示进度覆盖层 -->
                <div v-if="uploading" class="image-upload-uploading-overlay">
                    <div class="image-upload-progress-circle">
                        <svg viewBox="0 0 36 36" class="progress-ring">
                            <path class="progress-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="progress-ring-fill" :stroke-dasharray="`${uploadProgress}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <span class="progress-percent">{{ uploadProgress }}%</span>
                    </div>
                    <span class="upload-status-text">上传中...</span>
                </div>
                <template v-else>
                    <div v-if="previewIsSvga" ref="svgaPreviewRef" class="svga-preview-container" />
                    <video v-else-if="previewIsVideo" :src="localPreviewUrl" muted loop
                        autoplay playsinline />
                    <img v-else :src="localPreviewUrl" alt="preview" />
                </template>
                <span v-if="!uploading && provider" class="image-upload-provider-badge">
                    {{ provider.toUpperCase() }}
                </span>
                <span v-if="!uploading && uploadFailed" class="image-upload-provider-badge upload-failed-badge">
                    上传失败
                </span>
                <span v-else-if="!uploading && !provider" class="image-upload-provider-badge" style="background: #ff9800">
                    待上传
                </span>
                <div v-if="!uploading" class="image-upload-preview-actions">
                    <button class="preview-action-btn" @click="triggerFileInput" title="重新上传">
                        <UploadIcon />
                    </button>
                    <button class="preview-action-btn" @click="handleClear" title="删除">
                        <CloseIcon />
                    </button>
                </div>
            </div>

            <!-- 上传区域 -->
            <div v-else class="image-upload-dropzone" :class="{ uploading: uploading }"
                @click="!uploading && triggerFileInput()" @dragover.prevent @drop="handleDrop"
                :style="{ height: `${previewHeight || 160}px` }">
                <template v-if="uploading">
                    <div class="image-upload-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" :style="{ width: `${uploadProgress}%` }" />
                        </div>
                        <span class="progress-text">{{ uploadProgress }}%</span>
                    </div>
                </template>
                <template v-else>
                    <ImageIcon :size="32" :stroke-width="1.2" />
                    <span class="upload-hint">{{ placeholder }}</span>
                    <span class="upload-sub-hint">{{ acceptHint || `支持 JPG/PNG/GIF/WebP，最大 ${maxSize}MB` }}</span>
                </template>
            </div>

            <input ref="fileInputRef" type="file" :accept="accept || 'image/jpeg,image/png,image/gif,image/webp'"
                style="display: none" @change="handleFileChange" />
        </template>

        <!-- 图片预览（URL 输入模式下） -->
        <div v-if="modelValue && (urlInputMode || !uploadEnabled)" class="image-upload-preview url-preview" :style="{
            width: typeof previewWidth === 'number' ? `${previewWidth}px` : (previewWidth || '100%'),
            height: `${previewHeight || 120}px`,
            marginTop: '8px',
        }">
            <div v-if="isSvgaUrl(modelValue)" ref="svgaUrlPreviewRef" class="svga-preview-container" />
            <video v-else-if="isVideoUrl(modelValue)" :src="modelValue" muted loop autoplay playsinline />
            <img v-else :src="modelValue" alt="preview" @error="handlePreviewError" />
        </div>

        <!-- 裁剪弹窗 -->
        <t-dialog v-model:visible="cropModalVisible" header="裁剪图片" :width="600" :footer="false" class="image-crop-modal"
            @close="closeCropModal">
            <div class="image-crop-body">
                <div ref="cropAreaRef" class="image-crop-area">
                    <div v-if="imageLoading" class="image-crop-loading">
                        <div class="loading-spinner" />
                        <span>图片加载中...</span>
                    </div>
                    <Cropper v-else-if="cropImageSrc" ref="cropperRef" :src="cropImageSrc" 
                    style="width: 100%; height: 100%;"
                    :resize-image="{
                        adjustStencil: false
                    }" 
                    :stencil-component="RectangleStencil" 
                    :stencil-props="{
                aspectRatio: props.aspectRatio,
                movable: false,
                resizable: false,
                handlers: {},
                lines: {
                    north: true,
                    west: true,
                    south: true,
                    east: true,
                },
            }"
             :stencil-size="stencilSize" image-restriction="stencil" :min-zoom="0.5" :max-zoom="3"
                        :zoom="currentZoom" />
                </div>
            </div>

            <div class="image-crop-footer">
                <t-button variant="outline" shape="round" @click="closeCropModal">取消</t-button>
                <t-button theme="primary" shape="round" :disabled="imageLoading || !cropImageSrc" @click="handleCropConfirm"
                    class="crop-confirm-btn">
                    <span class="btn-content">
                        <CutIcon />
                        <span>确认裁剪</span>
                    </span>
                </t-button>
            </div>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue';
import { UploadIcon, CloseIcon, CutIcon, ImageIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { Cropper, RectangleStencil } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { Player as SVGAPlayer, Parser as SVGAParser } from 'svgaplayerweb';
import { uploadImage } from '@/api/upload';
import {
    isVideoUrl, isSvgaUrl, isSvgaFile, isVideoFile, getByteLength, readFileAsDataURL,
    initSvgaParser, getSvgaParserIfInited,
    validateImageUrl, validateImageFile, validateVideoFile, validateSvgaFile,
    validateFileType, validateFileSize, validateFileLoad,
    UrlValidationController,
} from '@live-manager/common';

// 初始化共享的 SVGA Parser
initSvgaParser(SVGAParser);

interface Props {
    modelValue?: string;
    type?: 'cover' | 'gift-icon' | 'gift-animation';
    cropEnabled?: boolean;
    aspectRatio?: number;
    maxSize?: number;
    placeholder?: string;
    showUrlInput?: boolean;
    previewWidth?: number | string;
    previewHeight?: number | string;
    uploadEnabled?: boolean;
    accept?: string;
    acceptHint?: string;
    maxBytes?: number;
    className?: string;
    deferUpload?: boolean;
    skipSvgaValidation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    type: 'cover',
    cropEnabled: true,
    aspectRatio: 16 / 9,
    maxSize: 10,
    placeholder: '点击或拖拽上传图片',
    showUrlInput: true,
    uploadEnabled: false,
    previewHeight: 160,
    deferUpload: false,
    skipSvgaValidation: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'fileReady': [file: File | Blob | null];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null);

const uploading = ref(false);
const uploadProgress = ref(0);
const uploadFailed = ref(false);
const provider = ref('');
const urlInputMode = ref(!props.uploadEnabled);
const urlInputValue = ref(props.modelValue);

// 延迟上传模式
const deferredFile = ref<File | Blob | null>(null);
const localPreviewUrl = ref('');
// 记录本地预览是否为视频（用于正确渲染 video 元素）
const previewIsVideo = ref(false);
// 记录本地预览是否为 SVGA（用于正确渲染 SVGA 播放器）
const previewIsSvga = ref(false);
// SVGA 预览播放器 ref（上传模式下本地预览）
const svgaPreviewRef = ref<HTMLDivElement | null>(null);
let svgaPlayerInstance: InstanceType<typeof SVGAPlayer> | null = null;
// SVGA URL 预览播放器 ref（URL 模式下远程预览）
const svgaUrlPreviewRef = ref<HTMLDivElement | null>(null);
let svgaUrlPlayerInstance: InstanceType<typeof SVGAPlayer> | null = null;





/** 清理 SVGA 播放器实例 */
function cleanupSvgaPlayer() {
  if (svgaPlayerInstance) {
    try { svgaPlayerInstance.stopAnimation(); svgaPlayerInstance.clear(); } catch { /* ignore */ }
    svgaPlayerInstance = null;
  }
}

/** 清理 SVGA URL 播放器实例 */
function cleanupSvgaUrlPlayer() {
  if (svgaUrlPlayerInstance) {
    try { svgaUrlPlayerInstance.stopAnimation(); svgaUrlPlayerInstance.clear(); } catch { /* ignore */ }
    svgaUrlPlayerInstance = null;
  }
}

/** 初始化 SVGA 本地预览播放器 */
function initSvgaPreview(url: string) {
  cleanupSvgaPlayer();
  nextTick(() => {
    if (!svgaPreviewRef.value) return;
    const player = new SVGAPlayer(svgaPreviewRef.value);
    player.loops = 0; // 循环播放（预览）
    player.setContentMode('AspectFit');
    svgaPlayerInstance = player;

    const parser = getSvgaParserIfInited();
    if (!parser) return;
    parser.load(
      url,
      (videoItem) => {
        player.setVideoItem(videoItem);
        player.startAnimation();
      },
      (error) => {
        console.error('[ImageUpload] SVGA preview load error:', error);
      },
    );
  });
}

/** 初始化 SVGA URL 预览播放器 */
function initSvgaUrlPreview(url: string) {
  cleanupSvgaUrlPlayer();
  nextTick(() => {
    if (!svgaUrlPreviewRef.value) return;
    const player = new SVGAPlayer(svgaUrlPreviewRef.value);
    player.loops = 0;
    player.setContentMode('AspectFit');
    svgaUrlPlayerInstance = player;

    const parser = getSvgaParserIfInited();
    if (!parser) return;
    parser.load(
      url,
      (videoItem) => {
        player.setVideoItem(videoItem);
        player.startAnimation();
      },
      (error) => {
        console.error('[ImageUpload] SVGA URL preview load error:', error);
      },
    );
  });
}

// 裁剪状态
const cropModalVisible = ref(false);
const cropImageSrc = ref('');
const zoom = ref(1);
const currentZoom = ref(1);
const imageLoading = ref(false);

// 裁剪区域容器引用
const cropAreaRef = ref<HTMLElement | null>(null);
const stencilSize = ref({ width: 300, height: 300 });

// 计算 stencil 尺寸
function calculateStencilSize() {
    if (!cropAreaRef.value) return;

    const containerWidth = cropAreaRef.value.clientWidth;
    const containerHeight = cropAreaRef.value.clientHeight || 320;

    // 容器宽高比
    const containerRatio = containerWidth / containerHeight;
    // 目标宽高比
    const targetRatio = props.aspectRatio || 16 / 9;

    let width: number;
    let height: number;

    if (targetRatio > containerRatio) {
        // 宽度受限制
        width = Math.min(containerWidth, 500);
        height = width / targetRatio;
    } else {
        // 高度受限制
        height = Math.min(containerHeight, 320);
        width = height * targetRatio;
    }

    stencilSize.value = { width: Math.round(width), height: Math.round(height) };
}

// 监听弹窗打开，计算 stencil 尺寸
watch(cropModalVisible, async (visible) => {
    if (visible) {
        await nextTick();
        // 等待图片加载完成后再计算
        setTimeout(calculateStencilSize, 100);
    }
});

// 监听 aspectRatio 变化
watch(() => props.aspectRatio, () => {
    if (cropModalVisible.value) {
        calculateStencilSize();
    }
});

onMounted(() => {
    // 窗口大小变化时重新计算
    window.addEventListener('resize', calculateStencilSize);
});

const urlValidating = ref(false);
const urlValidationError = ref('');

// 创建 URL 验证控制器（共享逻辑）
const urlValidationCtrl = new UrlValidationController({
    setValidating: (v) => { urlValidating.value = v; },
    setError: (msg) => { urlValidationError.value = msg; },
    onConfirm: (url) => { emit('update:modelValue', url); },
}, props.skipSvgaValidation);

// 同步 skipSvgaValidation
watch(() => props.skipSvgaValidation, (v) => {
    urlValidationCtrl.updateSkipSvgaValidation(!!v);
});

const byteLength = computed(() => {
    return getByteLength(urlInputValue.value);
});



// 同步外部 value，并自动判断模式
watch(() => props.modelValue, (val) => {
    urlInputValue.value = val;
    // 清除之前的验证错误
    urlValidationError.value = '';
    // 如果有值（URL），自动切换到 URL 模式（优先级高于 uploadEnabled 的 watch）
    if (val && props.uploadEnabled) {
        urlInputMode.value = true;
    }
    // 当 value 变化时，清理延迟上传相关的本地状态，避免显示上次的缓存
    // 注意：无论 value 是空字符串还是新值，都需要清理，因为用户可能清空了 URL
    if (props.deferUpload) {
        deferredFile.value = null;
        if (localPreviewUrl.value) {
            URL.revokeObjectURL(localPreviewUrl.value);
        }
        localPreviewUrl.value = '';
        previewIsVideo.value = false;
        previewIsSvga.value = false;
        cleanupSvgaPlayer();
        emit('fileReady', null);
    }
});

// 监听 uploadEnabled 变化，当变为 true 时自动切换到上传模式
// 但如果已有 URL（modelValue 非空），则保持 URL 模式以确保回显
watch(() => props.uploadEnabled, (enabled) => {
    if (enabled && !props.modelValue) {
        urlInputMode.value = false;
    }
});

// SVGA URL 预览：当 modelValue 指向 SVGA URL（URL 模式下），初始化 SVGA 播放器
watch(
    [() => props.modelValue, urlInputMode, () => props.uploadEnabled],
    ([val, isUrlMode, uploadEn]) => {
        const shouldShowUrlPreview = val && (isUrlMode || !uploadEn);
        if (shouldShowUrlPreview && isSvgaUrl(val as string)) {
            initSvgaUrlPreview(val as string);
        } else {
            cleanupSvgaUrlPlayer();
        }
    },
    { flush: 'post' },
);

onUnmounted(() => {
    if (localPreviewUrl.value) {
        URL.revokeObjectURL(localPreviewUrl.value);
    }
    // 清理 URL 验证控制器
    urlValidationCtrl.dispose();
    // 清理 SVGA 播放器
    cleanupSvgaPlayer();
    cleanupSvgaUrlPlayer();
    window.removeEventListener('resize', calculateStencilSize);
});


function triggerFileInput() {
    fileInputRef.value?.click();
}

function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        handleFileSelect(file);
    }
    (e.target as HTMLInputElement).value = '';
}

async function handleFileSelect(file: File) {
    // 验证文件类型
    const typeResult = validateFileType(file, props.accept);
    if (!typeResult.valid) {
        MessagePlugin.error(typeResult.errorHint!);
        return;
    }

    if (!validateFileSize(file, props.maxSize)) {
        MessagePlugin.error(`文件大小不能超过 ${props.maxSize}MB`);
        return;
    }

    // 实际加载验证
    try {
        await validateFileLoad(file, props.accept, props.skipSvgaValidation);
    } catch (err: any) {
        MessagePlugin.error(err.message || '文件加载失败，请检查文件是否完整');
        return;
    }

    if (props.cropEnabled) {
        zoom.value = 1;
        currentZoom.value = 1;
        cropImageSrc.value = '';
        imageLoading.value = true;
        cropModalVisible.value = true;

        try {
            const dataUrl = await readFileAsDataURL(file);
            cropImageSrc.value = dataUrl;
        } catch (error) {
            MessagePlugin.error('图片加载失败，请重试');
            cropModalVisible.value = false;
        } finally {
            imageLoading.value = false;
        }
    } else {
        await doUpload(file);
    }
}


async function handleCropConfirm() {
    if (!cropImageSrc.value || !cropperRef.value) return;

    try {
        const { canvas } = cropperRef.value.getResult();
        if (!canvas) {
            MessagePlugin.error('裁剪失败，请重试');
            return;
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (b) => {
                    if (b) resolve(b);
                    else reject(new Error('Canvas to Blob failed'));
                },
                'image/jpeg',
                0.92
            );
        });

        cropModalVisible.value = false;
        await doUpload(blob);
    } catch (error) {
        MessagePlugin.error('裁剪失败，请重试');
    }
}

function closeCropModal() {
    cropModalVisible.value = false;
    cropImageSrc.value = '';
}

async function doUpload(fileOrBlob: File | Blob) {
    if (props.deferUpload) {
        deferredFile.value = fileOrBlob;
        const previewUrl = URL.createObjectURL(fileOrBlob);
        if (localPreviewUrl.value) {
            URL.revokeObjectURL(localPreviewUrl.value);
        }
        localPreviewUrl.value = previewUrl;
        // 识别是否为 SVGA 文件
        const svga = isSvgaFile(fileOrBlob);
        const isVideo = isVideoFile(fileOrBlob);
        previewIsVideo.value = isVideo;
        previewIsSvga.value = svga;
        emit('fileReady', fileOrBlob);
        // 如果是 SVGA 文件，初始化 SVGA 播放器预览
        if (svga) {
            initSvgaPreview(previewUrl);
        }
        return;
    }

    uploading.value = true;
    uploadProgress.value = 0;
    try {
        const result = await uploadImage(fileOrBlob, props.type, (progress) => {
            uploadProgress.value = progress;
        });
        emit('update:modelValue', result.url);
        provider.value = result.provider || '';
        MessagePlugin.success('上传成功');
    } catch (error: any) {
        MessagePlugin.error(`上传失败: ${error.message || '网络错误'}`);
    } finally {
        uploading.value = false;
        uploadProgress.value = 0;
    }
}

function handleDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
}

// 切换到上传模式
function switchToUploadMode() {
    urlValidationCtrl.cancelValidation();
    urlValidating.value = false;
    urlValidationError.value = '';
    urlInputMode.value = false;
}

// 切换到 URL 模式
function switchToUrlMode() {
    urlValidationCtrl.cancelValidation();
    urlValidating.value = false;
    urlValidationError.value = '';
    urlInputMode.value = true;
}

// URL 输入确认（委托给控制器）
async function doUrlConfirm() {
    // 确保 urlInputValue 是字符串类型
    if (typeof urlInputValue.value !== 'string') {
        urlInputValue.value = String(urlInputValue.value);
    }
    await urlValidationCtrl.doUrlConfirm(
        urlInputValue.value,
        props.maxBytes,
    );
}

// focus 触发
function handleUrlFocus() {
    urlValidationCtrl.handleUrlFocus();
}

// blur 触发
function handleUrlBlur(e?: Event | string) {
    // 阻止事件对象被赋值给 urlInputValue
    if (e && typeof e === 'object' && 'target' in e) {
        (e as Event).preventDefault();
    }
    urlValidationCtrl.handleUrlBlur(
        urlInputValue.value,
        props.maxBytes,
    );
}

// 用户修改 URL 输入：清除验证错误 + 取消正在进行的验证
function handleUrlInput(val: string) {
    if (typeof val === 'string') {
        urlInputValue.value = val;
        // 清除之前的验证错误，使红框消失
        urlValidationError.value = '';
        // 取消正在进行的验证（避免旧结果覆盖新状态）
        urlValidationCtrl.cancelValidation();
        urlValidating.value = false;
    }
}

// Enter 触发
function handleUrlEnter(e?: Event | string) {
    // 阻止事件对象被赋值给 urlInputValue
    if (e && typeof e === 'object' && 'target' in e) {
        (e as Event).preventDefault();
    }
    urlValidationCtrl.handleUrlEnter(
        urlInputValue.value,
        props.maxBytes,
    );
}

function handleClear(e?: MouseEvent) {
    e?.stopPropagation();
    urlValidationCtrl.cancelValidation();
    urlValidating.value = false;
    urlValidationError.value = '';
    emit('update:modelValue', '');
    urlInputValue.value = '';
    provider.value = '';
    // 清理上传状态
    uploading.value = false;
    uploadProgress.value = 0;
    uploadFailed.value = false;
    // 清理 SVGA 播放器
    cleanupSvgaPlayer();
    cleanupSvgaUrlPlayer();
    if (props.deferUpload) {
        deferredFile.value = null;
        if (localPreviewUrl.value) {
            URL.revokeObjectURL(localPreviewUrl.value);
            localPreviewUrl.value = '';
        }
        previewIsVideo.value = false;
        previewIsSvga.value = false;
        emit('fileReady', null);
    }
}

function handlePreviewError(e: Event) {
    (e.target as HTMLImageElement).style.display = 'none';
}

// 暴露方法和属性
defineExpose({
    /** 当前是否处于 URL 输入模式（true=URL输入, false=文件上传） */
    get isUrlInputMode() {
        return urlInputMode.value;
    },
    /** 当前是否正在验证 URL */
    get isValidating() {
        return urlValidating.value;
    },
    /** URL 验证错误信息 */
    get urlValidationError() {
        return urlValidationError.value;
    },
    /** 当前 URL 是否存在错误（验证失败或字节超限），用于外部禁用提交按钮 */
    get hasUrlError() {
        // 不在 URL 输入模式时无错误
        if (!urlInputMode.value) return false;
        // 有验证错误
        if (urlValidationError.value) return true;
        // URL 字节超限
        if (props.maxBytes && urlInputValue.value.trim() && byteLength.value > props.maxBytes) return true;
        return false;
    },
    /** 当前 URL 输入框中的值（用于提交时校验实际输入） */
    get urlInputValue() {
        return urlInputValue.value;
    },
    /** 验证图片 URL 是否可访问 */
    validateImageUrl,
    /** 外部设置 URL 验证错误信息（用于必填校验等场景使输入框变红） */
    setUrlError(msg: string) {
        urlValidationError.value = msg;
    },
    /** 切换到 URL 输入模式 */
    switchToUrlMode,
    /** 重置组件内部状态，清理待上传文件、本地预览和 URL 输入 */
    reset() {
        // 重置控制器（清除 blur 定时器、取消验证、设置 resetFlag）
        urlValidationCtrl.reset();
        deferredFile.value = null;
        if (localPreviewUrl.value) {
            URL.revokeObjectURL(localPreviewUrl.value);
            localPreviewUrl.value = '';
        }
        previewIsVideo.value = false;
        previewIsSvga.value = false;
        // 清理 SVGA 播放器
        cleanupSvgaPlayer();
        cleanupSvgaUrlPlayer();
        // 重新同步 urlInputValue 为当前 modelValue（而非清空），
        // 避免弹窗关闭后再次打开时 modelValue 未变导致 watch 不触发、urlInputValue 为空的问题
        urlInputValue.value = props.modelValue || '';
        provider.value = '';
        urlValidationError.value = '';
        // 重置上传相关状态
        uploading.value = false;
        uploadProgress.value = 0;
        uploadFailed.value = false;
        // 根据当前是否有 URL 来决定模式：有 URL 则保持 URL 模式，无 URL 则切回上传模式
        if (props.uploadEnabled) {
            urlInputMode.value = !!props.modelValue;
        }
        emit('fileReady', null);
    },
    /**
     * 确保 URL 输入已验证并返回最终 URL。
     * - 如果当前不在 URL 输入模式，返回 null
     * - 如果正在验证，等待验证完成
     * - 如果输入框中有未 blur 确认的 URL，主动触发验证
     * - 验证成功返回 URL，验证失败抛出错误
     */
    async ensureUrlValidated(): Promise<string | null> {
        // 如果不在 URL 输入模式，不需要验证
        if (!urlInputMode.value) return null;

        return await urlValidationCtrl.ensureUrlValidatedWithErrorCheck(
            urlInputValue.value,
            props.modelValue || '',
            !!urlValidationError.value,
            props.maxBytes,
        );
    },
    async uploadPendingFile(): Promise<string | null> {
        const file = deferredFile.value;
        if (!file) return null;
        uploading.value = true;
        uploadProgress.value = 0;
        uploadFailed.value = false;
        try {
            const result = await uploadImage(file, props.type, (progress) => {
                uploadProgress.value = progress;
            });
            deferredFile.value = null;
            provider.value = result.provider || '';
            uploadFailed.value = false;
            return result.url;
        } catch (error: any) {
            uploadFailed.value = true;
            throw error;
        } finally {
            uploading.value = false;
            uploadProgress.value = 0;
        }
    },
});
</script>

<style scoped>
.image-upload-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    min-width: 0;
}

/* 模式切换 */
.image-upload-mode-switch {
    display: flex;
    gap: 0;
    margin-bottom: 8px;
    background: #F5F7FA;
    border-radius: 6px;
    padding: 2px;
}

.mode-switch-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 28px;
    padding: 0 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.5);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
}

.mode-switch-btn.active {
    background: white;
    color: #1C66E5;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.mode-switch-btn:hover:not(.active) {
    color: rgba(0, 0, 0, 0.7);
}

/* URL 输入 */
.image-upload-url-input {
    display: flex;
    gap: 8px;
}

/* URL 验证错误提示 */
.image-upload-url-error {
    font-size: 12px;
    color: #e54545;
    margin-top: 4px;
    line-height: 1.4;
}

/* 输入框内的验证中提示 */
.input-suffix-validating {
    color: #1C66E5;
    font-size: 12px;
    white-space: nowrap;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* 输入框内的字节计数后缀 */
.input-suffix-count {
    color: rgba(0, 0, 0, 0.4);
    font-size: 14px;
    white-space: nowrap;
}

.input-suffix-count.byte-overflow {
    color: #e54545;
}

/* 上传拖拽区 */
.image-upload-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    border: 1.5px dashed #D4D8E0;
    border-radius: 8px;
    background: #FAFBFC;
    cursor: pointer;
    transition: all 0.2s;
    color: rgba(0, 0, 0, 0.3);
}

.image-upload-dropzone:hover {
    border-color: #1C66E5;
    background: rgba(28, 102, 229, 0.02);
    color: #1C66E5;
}

.image-upload-dropzone.uploading {
    cursor: default;
    border-color: #1C66E5;
}

.upload-hint {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.5);
}

.upload-sub-hint {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.3);
}

/* 上传进度 */
.image-upload-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 60%;
}

.progress-bar {
    width: 100%;
    height: 4px;
    background: #E6E9F0;
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: #1C66E5;
    border-radius: 2px;
    transition: width 0.2s;
}

.progress-text {
    font-size: 12px;
    color: #1C66E5;
}

/* 预览区 */
.image-upload-preview {
    position: relative;
    border: 1px solid #E6E9F0;
    border-radius: 8px;
    overflow: hidden;
    background: #F9FAFC;
}

.image-upload-preview img,
.image-upload-preview video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}

/* SVGA 预览播放器 */
.svga-preview-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a1a;
}

.svga-preview-container :deep(canvas) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.image-upload-preview-actions {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 0.2s;
}

.image-upload-preview:hover .image-upload-preview-actions {
    opacity: 1;
}

.preview-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    cursor: pointer;
    color: #333;
    transition: all 0.2s;
}

.preview-action-btn:hover {
    background: white;
    transform: scale(1.1);
}

/* Provider 标记 */
.image-upload-provider-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: white;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 4px;
    pointer-events: none;
}

/* 上传失败标记 */
.upload-failed-badge {
    background: #e54545 !important;
}

/* 上传中覆盖层 */
.image-upload-uploading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
}

.image-upload-progress-circle {
    position: relative;
    width: 56px;
    height: 56px;
}

.progress-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}

.progress-ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.2);
    stroke-width: 3;
}

.progress-ring-fill {
    fill: none;
    stroke: #1C66E5;
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke-dasharray 0.2s ease;
}

.progress-percent {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: 600;
    color: white;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
}

.upload-status-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* 裁剪弹窗 */
.image-crop-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 24px;
}

.image-crop-area {
    position: relative;
    width: 100%;
    height: 320px;
    background: #1a1a1a;
    border-radius: 8px;
    overflow: hidden;
}

.image-crop-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: #1a1a1a;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #1C66E5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.image-crop-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid #F0F2F7;
}

.btn-content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.crop-confirm-btn :deep(.t-button__content) {
    display: flex;
    align-items: center;
}
</style>
