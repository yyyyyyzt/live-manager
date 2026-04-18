<template>
  <n-modal
    v-model:show="dialogVisible"
    :header="showSuccess ? '创建成功' : '新建直播间'"
    :width="560"
    placement="center"
    class="create-room-modal"
    @close="handleClose"
  >
    <n-form v-if="!showSuccess" class="create-room-form" :label-width="100" :colon="false">
      <!-- 直播间主播 -->
      <n-form-item label="直播间主播" :required-mark="true">
        <n-input
          v-model:value="formData.anchorId"
          placeholder="请输入主播ID"
          :status="anchorIdBytes > ANCHOR_ID_MAX_BYTES ? 'error' : undefined"
        >
          <template #suffix>
            <span class="input-suffix-count" :class="{ 'byte-overflow': anchorIdBytes > ANCHOR_ID_MAX_BYTES }">
              {{ anchorIdBytes }}/{{ ANCHOR_ID_MAX_BYTES }}
            </span>
          </template>
        </n-input>
      </n-form-item>

      <!-- 房间ID -->
      <n-form-item label="直播间 ID">
        <n-input
          :value="formData.anchorId ? `live_${formData.anchorId}` : ''"
          disabled
          readonly
          placeholder="请先输入主播ID，将自动生成直播间ID"
        />
      </n-form-item>

      <!-- 直播间标题 -->
      <n-form-item label="直播间标题">
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

      <!-- 布局模板 -->
      <n-form-item label="布局模板" :required-mark="true" :help="currentTemplateDesc">
        <n-select
          v-model:value="formData.seatTemplate"
          :options="seatTemplateSelectOptions"
          style="width: 100%"
        />
      </n-form-item>

      <!-- 最大麦位数 - 仅语聊房模板显示 -->
      <n-form-item v-if="formData.seatTemplate === 'AudioSalon' || formData.seatTemplate === 'Karaoke'" label="最大麦位数" help="语聊房模板可自定义麦位数量，受套餐包限制">
        <n-input-number
          :value="formData.maxSeatCount"
          @update:value="handleMaxSeatCountChange"
          :min="1"
          :max="16"
          :status="formData.maxSeatCount < 1 || formData.maxSeatCount > 16 ? 'error' : undefined"
          placeholder="请输入最大麦位数"
          style="width: 100%"
        />
      </n-form-item>

      <!-- OBS 推流选项 -->
      <n-form-item label="推流方式" help="勾选后创建成功将显示 OBS 推流信息">
        <n-checkbox v-model:checked="useObsStreaming">
          使用 OBS 推流
        </n-checkbox>
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
          <n-button style="width:80px;"
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

    <!-- 创建成功提示 -->
    <div v-else class="create-success-content">
      <div class="create-success-summary">
        <div class="create-success-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="#E8F5E9" />
            <path d="M14 24L21 31L34 18" stroke="#07C160" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h3>直播间创建成功</h3>
        <p v-if="successDescription" class="create-success-description" :class="{ 'is-error': successDescriptionError }">
          {{ successDescription }}
        </p>
      </div>

      <div v-if="streamInfo" class="create-success-section">
        <div class="create-success-section-title">推流信息</div>
        <div class="stream-info-items">
          <div class="stream-info-item">
            <div class="stream-info-label">
              <span>服务器地址</span>
              <button class="action-link" @click="handleCopy(streamInfo.serverUrl, '服务器地址')">
                <Copy /> 复制
              </button>
            </div>
            <code class="stream-info-value">{{ streamInfo.serverUrl }}</code>
          </div>
          <div class="stream-info-item">
            <div class="stream-info-label">
              <span>推流码</span>
              <button class="action-link" @click="handleCopy(streamInfo.streamKey, '推流码')">
                <Copy /> 复制
              </button>
            </div>
            <code class="stream-info-value">{{ streamInfo.streamKey }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="dialog-footer">
        <template v-if="!showSuccess">
          <n-button ghost round @click="handleClose">取消</n-button>
          <n-button type="primary" round :loading="creating" :disabled="creating || !formData.anchorId.trim() || coverUploadRef?.isValidating || coverUploadRef?.hasUrlError" @click="handleSubmit">
            {{ creating ? '创建中...' : '创建' }}
          </n-button>
        </template>
        <template v-else>
          <n-button type="primary" round @click="handleComplete">
            完成
          </n-button>
        </template>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ChevronDown, ChevronRight, Plus, X, Copy } from 'lucide-vue-next';
import { message } from '@/utils/message';
import { createRoom, addRobot, importAccount, pickUserOnSeat, getRobotList, getSeatList, getStreamInfoAsync } from '@/api/room';
import { getErrorMessage, resolveImageUploadUrl, ImageUploadResolveError } from '@live-manager/common';
import ImageUpload from './ImageUpload.vue';
import { copyText } from '@/utils';
import type { SeatTemplate, StreamInfo } from '@/types/room';

interface Props {
  visible: boolean;
  uploadEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  uploadEnabled: false,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'success': [];
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

interface CustomInfo {
  key: string;
  value: string;
}

interface CreateRoomFormData {
  anchorId: string;
  title: string;
  coverUrl: string;
  seatTemplate: SeatTemplate;
  maxSeatCount: number;
}

const CUSTOM_INFO_LIMITS = {
  maxCount: 10,
  maxKeyBytes: 50,
  maxValueBytes: 2 * 1024,
  maxTotalValueBytes: 16 * 1024,
};

const ANCHOR_ID_MAX_BYTES = 43;

const SEAT_TEMPLATE_OPTIONS: { value: SeatTemplate; label: string; desc: string; orientation: 'landscape' | 'portrait' }[] = [
  { value: 'VideoDynamicGrid9Seats', label: '动态宫格布局', desc: '根据连麦人数动态调整宫格大小', orientation: 'portrait' },
  { value: 'VideoDynamicFloat7Seats', label: '浮动小窗布局', desc: '连麦嘉宾以浮动小窗形式显示', orientation: 'portrait' },
  { value: 'VideoFixedGrid9Seats', label: '固定宫格布局', desc: '每个嘉宾占据一个固定宫格', orientation: 'portrait' },
  { value: 'VideoFixedFloat7Seats', label: '固定小窗布局', desc: '嘉宾以固定小窗形式显示', orientation: 'portrait' },
  { value: 'VideoLandscape4Seat', label: '横屏开播', desc: '1个主播视频位 + 3个连麦音频位', orientation: 'landscape' },
];

const seatTemplateSelectOptions = SEAT_TEMPLATE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

const getKeyBytes = (key: string) => getByteLength(key);
const getValueBytes = (value: string) => getByteLength(value);

const handleMaxSeatCountChange = (value: string | number | null | undefined) => {
  formData.value.maxSeatCount = Number(value) || 1;
};

const formData = ref<CreateRoomFormData>({
  anchorId: '',
  title: '',
  coverUrl: '',
  seatTemplate: 'VideoDynamicGrid9Seats',
  maxSeatCount: 8,
});

const customInfos = ref<CustomInfo[]>([]);
const customInfoExpanded = ref(false);
const creating = ref(false);
const showSuccess = ref(false);
const useObsStreaming = ref(false);
const obsSetupStatus = ref<'' | 'creating' | 'seating' | 'ready' | 'error'>('');
const obsSetupError = ref('');
const streamInfo = ref<StreamInfo | null>(null);
const streamInfoError = ref('');
const coverUploadRef = ref<InstanceType<typeof ImageUpload> | null>(null);
const hasPendingCover = ref(false);

const anchorIdBytes = computed(() => getByteLength(formData.value.anchorId));
const titleBytes = computed(() => getByteLength(formData.value.title));
const validCustomInfoCount = computed(() => customInfos.value.filter(i => i.key.trim()).length);

const currentTemplateDesc = computed(() => {
  const option = SEAT_TEMPLATE_OPTIONS.find(o => o.value === formData.value.seatTemplate);
  return option?.desc || '';
});

const coverAspectRatio = computed(() => {
  const option = SEAT_TEMPLATE_OPTIONS.find(o => o.value === formData.value.seatTemplate);
  return option?.orientation === 'landscape' ? 16 / 9 : 9 / 16;
});

const successDescription = computed(() => {
  if (!useObsStreaming.value) return '';

  if (obsSetupStatus.value === 'error') {
    return `OBS 配置失败：${obsSetupError.value}`;
  }

  if (streamInfo.value) {
    return 'OBS 已配置完成，可直接复制下方推流信息。';
  }

  if (streamInfoError.value) {
    return `OBS 已配置完成，但推流信息生成失败：${streamInfoError.value}`;
  }

  return 'OBS 已配置完成。';
});

const successDescriptionError = computed(() => obsSetupStatus.value === 'error' || !!streamInfoError.value);

const isCustomInfoKeyMissing = (info: CustomInfo) => !info.key.trim() && !!info.value.trim();

const handleFileReady = (file: File | Blob | null) => {
  hasPendingCover.value = !!file;
};

const handleCopy = async (text: string, label: string) => {
  try {
    await copyText(text);
    message.success(`${label}已复制到剪贴板`);
  } catch (error: any) {
    message.error(`复制失败: ${error.ErrorInfo || error.message || '未知错误'}`);
  }
};

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

const resetForm = () => {
  formData.value = {
    anchorId: '',
    title: '',
    coverUrl: '',
    seatTemplate: 'VideoDynamicGrid9Seats',
    maxSeatCount: 8,
  };
  customInfos.value = [];
  customInfoExpanded.value = false;
  showSuccess.value = false;
  useObsStreaming.value = false;
  obsSetupStatus.value = '';
  obsSetupError.value = '';
  streamInfo.value = null;
  streamInfoError.value = '';
  hasPendingCover.value = false;
  // 清理 ImageUpload 组件内部状态（取消验证、清理缓存预览）
  coverUploadRef.value?.reset();
};

const handleClose = () => {
  resetForm();
  emit('update:visible', false);
};

const handleSubmit = async () => {
  if (!formData.value.anchorId.trim()) {
    message.error('请输入直播间主播ID');
    return;
  }

  if (anchorIdBytes.value > ANCHOR_ID_MAX_BYTES) {
    message.error(`主播ID不能超过 ${ANCHOR_ID_MAX_BYTES} 字节（当前 ${anchorIdBytes.value} 字节）`);
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

  creating.value = true;
  obsSetupStatus.value = '';

  const roomId = `live_${formData.value.anchorId}`;
  const anchorId = formData.value.anchorId;

  try {
    // 1. 解析封面 URL（公共逻辑自动处理 URL 验证 / 文件上传 / fallback）
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
      creating.value = false;
      return;
    }

    // 2. 构建参数
    const params: any = {
      roomId,
      anchorId,
      title: formData.value.title,
      seatTemplate: formData.value.seatTemplate,
    };

    if (coverUrl) {
      params.coverUrl = coverUrl;
    }

    // MaxSeatCount 仅在语聊房模板下传递
    if (formData.value.seatTemplate === 'AudioSalon' || formData.value.seatTemplate === 'Karaoke') {
      params.maxSeatCount = formData.value.maxSeatCount;
    }

    const validCustomInfos: Record<string, string> = {};
    for (const info of customInfos.value) {
      const key = info.key.trim();
      if (key) {
        validCustomInfos[key] = info.value;
      }
    }
    if (Object.keys(validCustomInfos).length > 0) {
      params.customInfo = validCustomInfos;
    }

    // OBS 推流标记
    if (useObsStreaming.value) {
      params.useObsStreaming = true;
    }

    // 3. 创建房间
    const response = await createRoom(params);

    if (response.ErrorCode === 0 || response.ErrorCode === undefined) {
      streamInfo.value = null;
      streamInfoError.value = '';

      // 4. OBS 配置
      if (useObsStreaming.value) {
        // OBS 推流时机器人 ID 使用主播 ID + "_obs"
        const robotId = `${anchorId}_obs`;

        // 先获取机器人推流信息（userId 必须是机器人 ID，需要异步获取匹配的 userSig）
        try {
          const pushInfo = await getStreamInfoAsync(roomId, robotId);
          if (pushInfo) {
            streamInfo.value = {
              serverUrl: pushInfo.ServerUrl,
              streamKey: pushInfo.StreamKey,
            };
          } else {
            streamInfoError.value = '获取推流信息失败';
          }
        } catch (streamError: any) {
          streamInfoError.value = streamError.message || '获取推流信息失败';
        }

        try {

          const robotRes = await getRobotList(roomId);
          const robotList = robotRes.Response?.RobotList_Account || [];
          const hasRobot = robotList.includes(robotId);

          const seatRes = await getSeatList(roomId);
          const seatMembers = new Set<string>();
          seatRes.Response?.SeatList?.forEach((seat: any) => {
            if (seat.Member_Account) seatMembers.add(seat.Member_Account);
          });
          const onSeat = seatMembers.has(robotId);

          if (!hasRobot) {
            obsSetupStatus.value = 'creating';
            // 先导入账号到 IM 账号系统（腾讯云要求：添加机器人前必须先导入账号）
            const importRes = await importAccount(robotId, `OBS Robot ${robotId}`);
            if (importRes.ErrorCode !== 0 && importRes.Error !== 0) {
              // ErrorCode=70102 表示账号已存在，可以继续添加机器人
              if (importRes.ErrorCode !== 70102) {
                throw new Error(importRes.ErrorInfo || '导入账号失败');
              }
            }
            // 添加机器人
            const addRes = await addRobot(roomId, [robotId]);
            if (addRes.ErrorCode !== 0) {
              throw new Error(addRes.ErrorInfo || '添加机器人失败');
            }
          }

          if (!onSeat) {
            obsSetupStatus.value = 'seating';
            const seatRes = await pickUserOnSeat(roomId, robotId);
            if (seatRes.ErrorCode !== 0) {
              throw new Error(seatRes.ErrorInfo || '上麦失败');
            }
          }

          obsSetupStatus.value = 'ready';
        } catch (obsError: any) {
          console.error('OBS 设置失败:', obsError);
          obsSetupStatus.value = 'error';
          obsSetupError.value = obsError.message || 'OBS 设置失败';
        }
      }

      showSuccess.value = true;
      message.success(useObsStreaming.value ? '直播间创建成功，OBS 已配置' : '直播间创建成功');
    } else {
      const errorMsg = getErrorMessage(response.ErrorCode, response.ErrorInfo, response.ErrorMessage);
      message.error(`创建失败: ${errorMsg}`);
    }
  } catch (error: any) {
    message.error(`请求失败: ${error.message || '网络错误'}`);
  } finally {
    creating.value = false;
  }
};

const handleComplete = () => {
  resetForm();
  emit('success');
  emit('update:visible', false);
};
</script>

<style scoped>
/* TDesign Form 适配 */
.create-room-modal :deep(.n-form-item) {
  margin-bottom: 16px;
}

.create-room-modal :deep(.n-form-item:last-child) {
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
.create-room-modal :deep(.n-form-item .image-upload-container) {
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

/* 创建成功 */
.create-success-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.create-success-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.create-success-icon {
  margin-bottom: 8px;
}

.create-success-summary h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1D2129;
}

.create-success-description {
  margin: 0;
  font-size: 14px;
  color: #86909C;
}

.create-success-description.is-error {
  color: #E34D59;
}

.create-success-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create-success-section-title {
  font-size: 14px;
  font-weight: 500;
  color: #1D2129;
}

.stream-info-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stream-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stream-info-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #86909C;
}

.action-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #1C66E5;
  cursor: pointer;
  border-radius: 4px;
}

.action-link:hover {
  background: #F1F6FF;
}

.stream-info-value {
  display: block;
  padding: 8px 12px;
  background: #F5F7FA;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  color: #1D2129;
  word-break: break-all;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

