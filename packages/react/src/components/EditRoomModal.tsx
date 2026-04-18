import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronRightIcon, AddIcon, CloseIcon } from 'tdesign-icons-react';
import { Button, Dialog, Input } from 'tdesign-react';
import { Message } from './Toast';
import { updateRoomInfo, getRoomDetail } from '../api/room';
import ImageUpload from './ImageUpload';
import type { ImageUploadRef } from './ImageUpload';
import type { RoomInfo } from '../types';
import { FormLayout, FormField } from './FormField';
import { DIALOG_WIDTH, resolveImageUploadUrl, ImageUploadResolveError } from '@live-manager/common';
import './EditRoomModal.css';

/** 加载图片并返回其宽高比，失败时返回默认值 9:16（竖屏） */
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
      // 宽高比 > 1 为横屏，使用 16:9；否则为竖屏，使用 9:16
      resolve(ratio > 1 ? 16 / 9 : 9 / 16);
    };
    img.onerror = () => resolve(9 / 16);
    img.src = url;
  });
}

interface EditRoomModalProps {
  visible: boolean;
  room: RoomInfo | null;
  onClose: () => void;
  onSuccess: (updatedFields: { roomName: string; coverUrl: string }) => void;
  uploadEnabled?: boolean;
}

interface CustomInfo {
  key: string;
  value: string;
}

interface EditRoomFormData {
  title: string;
  coverUrl: string;
}

// 自定义信息限制
const CUSTOM_INFO_LIMITS = {
  maxCount: 10,
  maxKeyBytes: 50,
  maxValueBytes: 2 * 1024,       // 2KB
  maxTotalValueBytes: 16 * 1024,  // 16KB
};

/** 计算字符串的 UTF-8 字节长度 */
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export default function EditRoomModal({ visible, room, onClose, onSuccess, uploadEnabled = false }: EditRoomModalProps) {
  const [formData, setFormData] = useState<EditRoomFormData>({
    title: '',
    coverUrl: '',
  });
  const [customInfos, setCustomInfos] = useState<CustomInfo[]>([]);
  const [customInfoExpanded, setCustomInfoExpanded] = useState(false);
  // 记录初始加载时的 keys，用于提交时计算被删除的 keys
  const initialKeysRef = useRef<string[]>([]);
  // 根据已有封面图片检测到的裁剪宽高比
  const [coverAspectRatio, setCoverAspectRatio] = useState<number>(9 / 16);

  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 封面延迟上传相关
  const coverUploadRef = useRef<ImageUploadRef>(null);
  const [hasPendingCover, setHasPendingCover] = useState(false);

  // 当封面 URL 变化时，检测图片实际宽高比
  useEffect(() => {
    if (room?.coverUrl) {
      detectImageAspectRatio(room.coverUrl).then(setCoverAspectRatio);
    } else {
      setCoverAspectRatio(9 / 16);
    }
  }, [room?.coverUrl]);

  useEffect(() => {
    if (room && visible) {
      setFormData({
        title: room.title || '',
        coverUrl: room.coverUrl || '',
      });
      // 主动获取房间详情以加载自定义信息
      setLoadingDetail(true);
      getRoomDetail(room.id)
        .then((res) => {
          const roomInfo = res?.Response?.RoomInfo;
          if (roomInfo?.CustomInfo && typeof roomInfo.CustomInfo === 'object') {
            const infos = Object.entries(roomInfo.CustomInfo).map(([key, value]) => ({
              key,
              value: String(value),
            }));
            setCustomInfos(infos);
            setCustomInfoExpanded(infos.length > 0);
            initialKeysRef.current = infos.map(i => i.key);
          } else {
            setCustomInfos([]);
            setCustomInfoExpanded(false);
            initialKeysRef.current = [];
          }
        })
        .catch(() => {
          if (room.customInfo && typeof room.customInfo === 'object') {
            const infos = Object.entries(room.customInfo).map(([key, value]) => ({
              key,
              value: String(value),
            }));
            setCustomInfos(infos);
            setCustomInfoExpanded(infos.length > 0);
            initialKeysRef.current = infos.map(i => i.key);
          } else {
            setCustomInfos([]);
            setCustomInfoExpanded(false);
            initialKeysRef.current = [];
          }
        })
        .finally(() => setLoadingDetail(false));
    }
  }, [room, visible]);

  // 添加自定义信息
  const addCustomInfo = () => {
    if (customInfos.length >= CUSTOM_INFO_LIMITS.maxCount) {
      showMessage('error', `自定义信息最多 ${CUSTOM_INFO_LIMITS.maxCount} 条`);
      return;
    }
    setCustomInfos([...customInfos, { key: '', value: '' }]);
  };

  // 更新自定义信息
  const updateCustomInfo = (index: number, field: 'key' | 'value', value: string) => {
    const newInfos = [...customInfos];
    newInfos[index][field] = value;
    setCustomInfos(newInfos);
  };

  // 删除自定义信息
  const removeCustomInfo = (index: number) => {
    setCustomInfos(customInfos.filter((_, i) => i !== index));
  };

  const isCustomInfoKeyMissing = (info: CustomInfo) => !info.key.trim() && !!info.value.trim();

  const showMessage = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      Message.success(msg);
    } else {
      Message.error(msg);
    }
  };

  // 关闭弹窗
  const handleClose = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setCustomInfos([]);
    setCustomInfoExpanded(false);
    initialKeysRef.current = [];
    setHasPendingCover(false);
    // 清理 ImageUpload 组件内部状态（取消验证、清理缓存预览）
    coverUploadRef.current?.reset();
    // 清空表单数据，确保下次打开时 value 从空变为有值，触发 ImageUpload 的 useEffect 重新同步
    setFormData({ title: '', coverUrl: '' });
    onClose();
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!room) return;

    // 验证
    if (!formData.title.trim()) {
      showMessage('error', '请输入直播间标题');
      return;
    }
    const titleBytes = getByteLength(formData.title);
    if (titleBytes > 100) {
      showMessage('error', `标题不能超过 100 字节（当前 ${titleBytes} 字节）`);
      return;
    }

    if (customInfos.some(isCustomInfoKeyMissing)) {
      showMessage('error', '自定义信息填写了 Value 时必须填写 Key');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      // 解析封面 URL（公共逻辑自动处理 URL 验证 / 文件上传 / fallback）
      let coverUrl = '';
      try {
        coverUrl = await resolveImageUploadUrl({
          handle: coverUploadRef.current,
          hasPendingFile: hasPendingCover,
          fallbackUrl: formData.coverUrl,
          label: '封面图片',
        });
      } catch (err: any) {
        showMessage('error', err instanceof ImageUploadResolveError ? err.message : `封面处理失败: ${err.message || '未知错误'}`);
        setSaving(false);
        return;
      }

      // 构建自定义信息对象
      const customInfo: Record<string, string> = {};
      let totalValueBytes = 0;
      for (const info of customInfos) {
        const trimmedKey = info.key.trim();
        if (!trimmedKey) continue;

        const keyBytes = getByteLength(trimmedKey);
        if (keyBytes > CUSTOM_INFO_LIMITS.maxKeyBytes) {
          showMessage('error', `Key "${trimmedKey}" 超过 ${CUSTOM_INFO_LIMITS.maxKeyBytes} 字节限制（当前 ${keyBytes} 字节）`);
          setSaving(false);
          return;
        }

        const valueBytes = getByteLength(info.value);
        if (valueBytes > CUSTOM_INFO_LIMITS.maxValueBytes) {
          showMessage('error', `Key "${trimmedKey}" 的 Value 超过 2KB 限制（当前 ${valueBytes} 字节）`);
          setSaving(false);
          return;
        }

        totalValueBytes += valueBytes;
        customInfo[trimmedKey] = info.value;
      }

      if (Object.keys(customInfo).length > CUSTOM_INFO_LIMITS.maxCount) {
        showMessage('error', `自定义信息最多 ${CUSTOM_INFO_LIMITS.maxCount} 条`);
        setSaving(false);
        return;
      }

      if (totalValueBytes > CUSTOM_INFO_LIMITS.maxTotalValueBytes) {
        showMessage('error', `所有 Value 总大小超过 16KB 限制（当前 ${(totalValueBytes / 1024).toFixed(1)}KB）`);
        setSaving(false);
        return;
      }

      // 计算被删除的 keys（初始有但当前没有的）
      const currentKeys = new Set(Object.keys(customInfo));
      const deleteKeys = initialKeysRef.current.filter(k => !currentKeys.has(k));

      console.log('[EditRoomModal] initialKeys:', initialKeysRef.current, 'currentKeys:', [...currentKeys], 'deleteKeys:', deleteKeys);

      const response = await updateRoomInfo(room.id, {
        roomName: formData.title.trim(),
        coverUrl: coverUrl || undefined,
        customInfo: Object.keys(customInfo).length > 0 ? customInfo : undefined,
        deleteKeys: deleteKeys.length > 0 ? deleteKeys : undefined,
      });

      if (response.ErrorCode === 0 || response.ErrorCode === undefined) {
        showMessage('success', '直播间信息已更新');

        setTimeout(() => {
          onSuccess({
            roomName: formData.title.trim(),
            coverUrl: coverUrl,
          });
          handleClose();
        }, 500);
      } else {
        showMessage('error', `更新失败: ${response.ErrorMessage || '未知错误'}`);
      }
    } catch (error: any) {
      showMessage('error', `请求失败: ${error.message || '网络错误'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !room) return null;

  return (
    <Dialog
      key={`edit-room-${room?.id}`}
      destroyOnClose
      visible={visible}
      header="编辑直播间"
      onClose={handleClose}
      width={DIALOG_WIDTH.FORM}
      placement="center"
      className="edit-room-modal"
      footer={
        <>
          <Button shape="round" variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            shape="round"
            theme="primary"
            onClick={handleSubmit}
            loading={saving}
            disabled={saving || !formData.title.trim() || (coverUploadRef.current?.isValidating) || (coverUploadRef.current?.hasUrlError)}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </>
      }
    >
      <FormLayout className="edit-room-form" labelWidth={100}>
        {/* 直播间ID - 不可修改 */}
        <FormField label="直播间 ID">
          <Input
            value={room.id}
            disabled
            readonly
          />
        </FormField>

        {/* 直播间标题 */}
        <FormField label="直播间标题" requiredMark>
          <div className="form-field__input-wrapper">
            <Input
              value={formData.title}
              onChange={(value) => setFormData(prev => ({ ...prev, title: String(value) }))}
              placeholder="请输入直播间标题"
              status={getByteLength(formData.title) > 100 ? 'error' : 'default'}
              suffix={
                <span className={`input-suffix-count${getByteLength(formData.title) > 100 ? ' byte-overflow' : ''}`}>
                  {getByteLength(formData.title)}/100
                </span>
              }
            />
            {getByteLength(formData.title) > 100 && (
              <div className="form-field__error-tip">标题不能超过 100 字节</div>
            )}
          </div>
        </FormField>

        {/* 直播间封面 */}
        <FormField label="直播间封面">
          <ImageUpload
            ref={coverUploadRef}
            value={formData.coverUrl}
            onChange={(url) => {
              setFormData(prev => ({ ...prev, coverUrl: url }));
              setHasPendingCover(false);
            }}
            type="cover"
            uploadEnabled={uploadEnabled}
            cropEnabled={true}
            aspectRatio={coverAspectRatio}
            placeholder="点击或拖拽上传封面图片"
            previewHeight={140}
            maxBytes={200}
            deferUpload={uploadEnabled}
            onFileReady={(file) => setHasPendingCover(!!file)}
          />
        </FormField>

        {/* 自定义信息 - 折叠/展开区域 */}
        <div className="custom-info-section">
          <div
            className="custom-info-toggle"
            onClick={() => setCustomInfoExpanded(!customInfoExpanded)}
          >
            {customInfoExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
            <span>自定义信息</span>
            {customInfos.length > 0 && (
              <span className="custom-info-count">{customInfos.length}</span>
            )}
          </div>
          {customInfoExpanded && (
            <div className="custom-info-container">
              {customInfos.map((info, index) => {
                const keyBytes = getByteLength(info.key);
                const valueBytes = getByteLength(info.value);
                const keyOverflow = keyBytes > CUSTOM_INFO_LIMITS.maxKeyBytes;
                const valueOverflow = valueBytes > CUSTOM_INFO_LIMITS.maxValueBytes;
                const missingKey = isCustomInfoKeyMissing(info);
                return (
                  <div key={index} className="custom-info-row">
                    <div className="custom-input-wrap">
                      <Input
                        value={info.key}
                        onChange={(value) => updateCustomInfo(index, 'key', String(value))}
                        placeholder="请输入Key"
                        status={keyOverflow || missingKey ? 'error' : 'default'}
                        tips={keyOverflow ? `Key 超出 ${CUSTOM_INFO_LIMITS.maxKeyBytes} 字节限制` : missingKey ? '填写了 Value 时必须填写 Key' : ''}
                      />
                    </div>
                    <div className="custom-input-wrap custom-value-wrap">
                      <Input
                        value={info.value}
                        onChange={(value) => updateCustomInfo(index, 'value', String(value))}
                        placeholder="请输入Value"
                        status={valueOverflow ? 'error' : 'default'}
                        tips={valueOverflow ? 'Value 超出 2KB 限制' : ''}
                      />
                    </div>
                    <Button
                      shape="square"
                      variant="text"
                      className="remove-custom-info-btn"
                      onClick={() => removeCustomInfo(index)}
                      title="删除"
                      icon={<CloseIcon size={14} />}
                    />
                  </div>
                );
              })}
              {customInfos.length < CUSTOM_INFO_LIMITS.maxCount && (
                <Button variant="text" className="add-custom-info-btn" onClick={addCustomInfo} icon={<AddIcon size={14} />} theme='primary'>
                  添加
                </Button>
              )}
            </div>
          )}
        </div>
      </FormLayout>
    </Dialog>
  );
}
