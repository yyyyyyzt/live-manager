<template>
  <n-modal
    v-model:show="dialogVisible"
    header="编辑直播间"
    :width="560"
    placement="center"
    class="edit-room-modal"
    @close="handleClose"
  >
    <n-form class="edit-room-form" :label-width="100" :colon="false">
      <!-- 直播间ID -->
      <n-form-item label="直播间 ID">
        <n-input
          :value="roomId"
          disabled
          readonly
        />
      </n-form-item>

      <!-- 直播间标题 -->
      <n-form-item label="直播间标题" :required-mark="true">
        <n-input
          v-model:value="formData.title"
          placeholder="请输入直播间标题"
          :status="titleBytes > 100 ? 'error' : undefined"
        >
          <template #suffix>
            <span class="input-suffix-count" :class="{ 'byte-overflow': titleBytes > 100 }">
              {{ titleBytes }}/100
            </span>
          </template>
        </n-input>
      </n-form-item>

      <!-- 直播间封面 -->
      <n-form-item label="直播间封面">
        <ImageUpload
          ref="coverUploadRef"
          v-model:value="formData.coverUrl"
          type="cover"
          :upload-enabled="uploadEnabled"
          :crop-enabled="true"
          :aspect-ratio="coverAspectRatio"
          placeholder="点击或拖拽上传封面图片"
          :preview-height="140"
          :max-bytes="200"
          :defer-upload="uploadEnabled"
          @file-ready="handleFileReady"
        />
      </n-form-item>

      <!-- 自定义信息 - 折叠/展开区域 -->
      <div class="custom-info-section">
        <div class="custom-info-toggle" @click="customInfoExpanded = !customInfoExpanded">
          <ChevronDown v-if="customInfoExpanded" :size="16" />
          <ChevronRight v-else :size="16" />
          <span>自定义信息</span>
          <span v-if="customInfos.length > 0" class="custom-info-count">{{ customInfos.length }}</span>
        </div>
        <div v-if="customInfoExpanded" class="custom-info-container">
          <div v-for="(info, index) in customInfos" :key="index" class="custom-info-row">
            <div class="custom-input-wrap">
              <n-input
                v-model:value="info.key"
                placeholder="请输入Key"
                :status="getKeyBytes(info.key) > CUSTOM_INFO_LIMITS.maxKeyBytes || isCustomInfoKeyMissing(info) ? 'error' : undefined"
              />
            </div>
            <div class="custom-input-wrap custom-value-wrap">
              <n-input
                v-model:value="info.value"
                placeholder="请输入Value"
                :status="getValueBytes(info.value) > CUSTOM_INFO_LIMITS.maxValueBytes ? 'error' : undefined"
              />
            </div>
            <n-button quaternary circle @click="removeCustomInfo(index)">
              <X />
            </n-button>
          </div>
          <n-button style="width:80px"
            v-if="customInfos.length < CUSTOM_INFO_LIMITS.maxCount"
            quaternary
            round
            @click="addCustomInfo"
            type="primary"
          >
            <template #icon><Plus /></template>
            添加
          </n-button>
        </div>
      </div>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button ghost round @click="handleClose">取消</n-button>
        <n-button type="primary" round :loading="saving" :disabled="saving || !formData.title.trim() || coverUploadRef?.isValidating || coverUploadRef?.hasUrlError" @click="handleSubmit">
          {{ saving ? '保存中...' : '保存' }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-vue-next';
import { message } from '@/utils/message';
import { updateRoomInfo, getRoomDetail } from '@/api/room';
import { resolveImageUploadUrl, ImageUploadResolveError } from '@live-manager/common';
import ImageUpload from './ImageUpload.vue';
import type { RoomInfo, RoomListItem } from '@/types';

interface Props {
  visible: boolean;
  room: (RoomInfo & { RoomId?: string; RoomName?: string; CoverURL?: string }) | RoomListItem | null;
  uploadEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  uploadEnabled: false,
});

// 获取房间ID（兼容两种类型）
const roomId = computed(() => {
  if (!props.room) return '';
  // RoomListItem 类型有 RoomId 字段
  if ('RoomId' in props.room && props.room.RoomId) {
    return props.room.RoomId;
  }
  // RoomInfo 类型有 id 字段
  if ('id' in props.room && props.room.id) {
    return props.room.id;
  }
  return '';
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'success': [updatedFields: { roomName: string; coverUrl: string }];
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

interface CustomInfo {
  key: string;
  value: string;
}

interface EditRoomFormData {
  title: string;
  coverUrl: string;
}

const CUSTOM_INFO_LIMITS = {
  maxCount: 10,
  maxKeyBytes: 50,
  maxValueBytes: 2 * 1024,
  maxTotalValueBytes: 16 * 1024,
};

function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

const getKeyBytes = (key: string) => getByteLength(key);
const getValueBytes = (value: string) => getByteLength(value);

function detectImageAspectRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(9 / 16);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      resolve(ratio > 1 ? 16 / 9 : 9 / 16);
    };
    img.onerror = () => resolve(9 / 16);
    img.src = url;
  });
}

const formData = ref<EditRoomFormData>({
  title: '',
  coverUrl: '',
});

const customInfos = ref<CustomInfo[]>([]);
const customInfoExpanded = ref(false);
const initialKeys = ref<string[]>([]);
const coverAspectRatio = ref(9 / 16);
const saving = ref(false);

// 封面延迟上传相关
const coverUploadRef = ref<InstanceType<typeof ImageUpload> | null>(null);
const hasPendingCover = ref(false);

const handleFileReady = (file: File | Blob | null) => {
  hasPendingCover.value = !!file;
};

const titleBytes = computed(() => getByteLength(formData.value.title));
const validCustomInfoCount = computed(() => customInfos.value.filter(i => i.key.trim()).length);

const isCustomInfoKeyMissing = (info: CustomInfo) => !info.key.trim() && !!info.value.trim();

// 监听 room 变化，加载表单数据
watch([() => props.room, () => props.visible], async ([room, visible]) => {
  if (room && visible) {
    // 兼容两种类型：RoomListItem (RoomName, CoverURL) 和 RoomInfo (title, coverUrl)
    const title = 'RoomName' in room ? room.RoomName : (room.title || '');
    const coverUrl = 'CoverURL' in room ? room.CoverURL : (room.coverUrl || '');
    const id = 'RoomId' in room ? room.RoomId : room.id;
    if (!id) {
      return;
    }

    formData.value = {
      title: title || '',
      coverUrl: coverUrl || '',
    };

    // 检测封面宽高比
    if (coverUrl) {
      coverAspectRatio.value = await detectImageAspectRatio(coverUrl);
    } else {
      coverAspectRatio.value = 9 / 16;
    }

    // 加载自定义信息
    try {
      const res = await getRoomDetail(id);
      const roomInfo = res?.Response?.RoomInfo;
      if (roomInfo?.CustomInfo && typeof roomInfo.CustomInfo === 'object') {
        const infos = Object.entries(roomInfo.CustomInfo).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        customInfos.value = infos;
        customInfoExpanded.value = infos.length > 0;
        initialKeys.value = infos.map(i => i.key);
      } else {
        customInfos.value = [];
        customInfoExpanded.value = false;
        initialKeys.value = [];
      }
    } catch {
      // 从 room 中获取自定义信息
      const customInfo = 'CustomInfo' in room ? room.CustomInfo : room.customInfo;
      if (customInfo && typeof customInfo === 'object') {
        // CustomInfo 在 RoomListItem 中是 string 类型，需要解析
        if (typeof customInfo === 'string') {
          try {
            const parsed = JSON.parse(customInfo);
            const infos = Object.entries(parsed).map(([key, value]) => ({
              key,
              value: String(value),
            }));
            customInfos.value = infos;
            customInfoExpanded.value = infos.length > 0;
            initialKeys.value = infos.map(i => i.key);
          } catch {
            customInfos.value = [];
            customInfoExpanded.value = false;
            initialKeys.value = [];
          }
        } else {
          const infos = Object.entries(customInfo).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          customInfos.value = infos;
          customInfoExpanded.value = infos.length > 0;
          initialKeys.value = infos.map(i => i.key);
        }
      } else {
        customInfos.value = [];
        customInfoExpanded.value = false;
        initialKeys.value = [];
      }
    }
  }
}, { immediate: true });

const addCustomInfo = () => {
  if (customInfos.value.length >= CUSTOM_INFO_LIMITS.maxCount) {
    message.error(`自定义信息最多 ${CUSTOM_INFO_LIMITS.maxCount} 条`);
    return;
  }
  customInfos.value.push({ key: '', value: '' });
};

const removeCustomInfo = (index: number) => {
  customInfos.value.splice(index, 1);
};

const handleClose = () => {
  customInfos.value = [];
  customInfoExpanded.value = false;
  initialKeys.value = [];
  hasPendingCover.value = false;
  // 清理 ImageUpload 组件内部状态（取消验证、清理缓存预览）
  coverUploadRef.value?.reset();
  // 清空表单数据，确保下次打开时 modelValue 从空变为有值，触发 ImageUpload 的 watch 重新同步
  formData.value = { title: '', coverUrl: '' };
  emit('update:visible', false);
};

const handleSubmit = async () => {
  if (!props.room) return;

  if (!formData.value.title.trim()) {
    message.error('请输入直播间标题');
    return;
  }

  if (titleBytes.value > 100) {
    message.error(`标题不能超过 100 字节（当前 ${titleBytes.value} 字节）`);
    return;
  }

  if (customInfos.value.some(isCustomInfoKeyMissing)) {
    message.error('自定义信息填写了 Value 时必须填写 Key');
    return;
  }

  saving.value = true;

  try {
    // 解析封面 URL（公共逻辑自动处理 URL 验证 / 文件上传 / fallback）
    let coverUrl = '';
    try {
      coverUrl = await resolveImageUploadUrl({
        handle: coverUploadRef.value as any,
        hasPendingFile: hasPendingCover.value,
        fallbackUrl: formData.value.coverUrl,
        label: '封面图片',
      });
    } catch (err: any) {
      message.error(err instanceof ImageUploadResolveError ? err.message : `封面处理失败: ${err.message || '未知错误'}`);
      saving.value = false;
      return;
    }

    // 构建自定义信息
    const customInfo: Record<string, string> = {};
    let totalValueBytes = 0;

    for (const info of customInfos.value) {
      const trimmedKey = info.key.trim();
      if (!trimmedKey) continue;

      const keyBytes = getByteLength(trimmedKey);
      if (keyBytes > CUSTOM_INFO_LIMITS.maxKeyBytes) {
        message.error(`Key "${trimmedKey}" 超过 ${CUSTOM_INFO_LIMITS.maxKeyBytes} 字节限制`);
        saving.value = false;
        return;
      }

      const valueBytes = getByteLength(info.value);
      if (valueBytes > CUSTOM_INFO_LIMITS.maxValueBytes) {
        message.error(`Key "${trimmedKey}" 的 Value 超过 2KB 限制`);
        saving.value = false;
        return;
      }

      totalValueBytes += valueBytes;
      customInfo[trimmedKey] = info.value;
    }

    if (Object.keys(customInfo).length > CUSTOM_INFO_LIMITS.maxCount) {
      message.error(`自定义信息最多 ${CUSTOM_INFO_LIMITS.maxCount} 条`);
      saving.value = false;
      return;
    }

    if (totalValueBytes > CUSTOM_INFO_LIMITS.maxTotalValueBytes) {
      message.error(`所有 Value 总大小超过 16KB 限制`);
      saving.value = false;
      return;
    }

    // 计算被删除的 keys
    const currentKeys = new Set(Object.keys(customInfo));
    const deleteKeys = initialKeys.value.filter(k => !currentKeys.has(k));

    const response = await updateRoomInfo(roomId.value, {
      roomName: formData.value.title.trim(),
      coverUrl: coverUrl || undefined,
      customInfo: Object.keys(customInfo).length > 0 ? customInfo : undefined,
      deleteKeys: deleteKeys.length > 0 ? deleteKeys : undefined,
    });

    if (response.ErrorCode === 0 || response.ErrorCode === undefined) {
      message.success('直播间信息已更新');
      emit('success', {
        roomName: formData.value.title.trim(),
        coverUrl: coverUrl,
      });
      handleClose();
    } else {
      message.error(`更新失败: ${response.ErrorMessage || '未知错误'}`);
    }
  } catch (error: any) {
    message.error(`请求失败: ${error.message || '网络错误'}`);
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
/* TDesign Form 适配 */
.edit-room-modal :deep(.n-form-item) {
  margin-bottom: 16px;
}

.edit-room-modal :deep(.t-form__item:last-child) {
  margin-bottom: 0;
}

/* 输入框内的字节计数后缀 */
.input-suffix-count {
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
  white-space: nowrap;
}

.input-suffix-count.byte-overflow {
  color: #E34D59;
}

/* ImageUpload 在 FormItem 内自适应宽度 */
.edit-room-modal :deep(.t-form__controls-content .image-upload-container) {
  width: 100%;
}

.field-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #888;
  font-weight: normal;
}

/* 自定义信息折叠/展开区域 */
.custom-info-section {
  margin-top: 4px;
}

.custom-info-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.6);
  padding: 4px 0;
  transition: color 0.2s;
}

.custom-info-toggle:hover {
  color: rgba(0, 0, 0, 0.9);
}

.custom-info-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #E3F1FC;
  color: #1C66E5;
  font-size: 12px;
  line-height: 1;
  margin-left: 4px;
}

/* 自定义信息 */
.custom-info-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.custom-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-input-wrap {
  flex: 1;
}

.custom-value-wrap {
  flex: 2;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

