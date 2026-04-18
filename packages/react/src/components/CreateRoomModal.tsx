import { useState, useRef } from 'react';
import { ChevronDownIcon, ChevronRightIcon, AddIcon, CloseIcon, FileCopyIcon } from 'tdesign-icons-react';
import { Button, Dialog, Select, Input, InputNumber, Checkbox } from 'tdesign-react';
import { Message } from './Toast';
import { createRoom, addRobot, importAccount, pickUserOnSeat, getRobotList, getSeatList, getStreamInfoAsync } from '../api/room';
import ImageUpload from './ImageUpload';
import type { ImageUploadRef } from './ImageUpload';
import { copyText } from '../utils';
import { buildAnchorLiveEntryUrl } from '../utils/anchorEntry';
import { FormLayout, FormField } from './FormField';
import { DIALOG_WIDTH, resolveImageUploadUrl, ImageUploadResolveError } from '@live-manager/common';
import type { SeatTemplate, StreamInfo } from '../types/room';
import './CreateRoomModal.css';

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  uploadEnabled?: boolean;
}

interface CustomInfo {
  key: string;
  value: string;
}

// 自定义信息限制（与 EditRoomModal 保持一致）
const CUSTOM_INFO_LIMITS = {
  maxCount: 10,
  maxKeyBytes: 50,
  maxValueBytes: 2 * 1024,       // 2KB
  maxTotalValueBytes: 16 * 1024,  // 16KB
};

interface CreateRoomFormData {
  anchorId: string;
  title: string;
  coverUrl: string;
  seatTemplate: SeatTemplate;
  maxSeatCount: number;
}

// 字节限制常量（房间ID最多48字节，扣除 live_ 前缀5字节）
const ANCHOR_ID_MAX_BYTES = 43;

/** 计算字符串的 UTF-8 字节长度 */
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

// SeatTemplate 选项定义
const SEAT_TEMPLATE_OPTIONS: { value: SeatTemplate; label: string; desc: string; orientation: 'landscape' | 'portrait' }[] = [
  { value: 'VideoDynamicGrid9Seats', label: '动态宫格布局', desc: '根据连麦人数动态调整宫格大小', orientation: 'portrait' },
  { value: 'VideoDynamicFloat7Seats', label: '浮动小窗布局', desc: '连麦嘉宾以浮动小窗形式显示', orientation: 'portrait' },
  { value: 'VideoFixedGrid9Seats', label: '固定宫格布局', desc: '每个嘉宾占据一个固定宫格', orientation: 'portrait' },
  { value: 'VideoFixedFloat7Seats', label: '固定小窗布局', desc: '嘉宾以固定小窗形式显示', orientation: 'portrait' },
  { value: 'VideoLandscape4Seat', label: '横屏开播', desc: '1个主播视频位 + 3个连麦音频位', orientation: 'landscape' },
];

const SEAT_TEMPLATE_SELECT_OPTIONS = SEAT_TEMPLATE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/** 根据布局模板获取封面裁剪宽高比：横屏 16:9，竖屏 9:16 */
function getCoverAspectRatio(seatTemplate: SeatTemplate): number {
  const option = SEAT_TEMPLATE_OPTIONS.find(o => o.value === seatTemplate);
  return option?.orientation === 'landscape' ? 16 / 9 : 9 / 16;
}

export default function CreateRoomModal({ visible, onClose, onSuccess, uploadEnabled = false }: CreateRoomModalProps) {
  const [formData, setFormData] = useState<CreateRoomFormData>({
    anchorId: '',
    title: '',
    coverUrl: '',
    seatTemplate: 'VideoDynamicGrid9Seats',
    maxSeatCount: 8,
  });
  const [customInfos, setCustomInfos] = useState<CustomInfo[]>([]);
  const [customInfoExpanded, setCustomInfoExpanded] = useState(false);

  const [creating, setCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [useObsStreaming, setUseObsStreaming] = useState(false);
  const [obsSetupStatus, setObsSetupStatus] = useState<'' | 'creating' | 'seating' | 'ready' | 'error'>('');
  const [obsSetupError, setObsSetupError] = useState('');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [streamInfoError, setStreamInfoError] = useState('');
  /** 创建成功页展示「主播入口」占位链接 */
  const [anchorEntrySnapshot, setAnchorEntrySnapshot] = useState<{ roomId: string; anchorUserId: string } | null>(null);

  // 封面延迟上传相关
  const coverUploadRef = useRef<ImageUploadRef>(null);
  const [hasPendingCover, setHasPendingCover] = useState(false);

  const showMessage = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      Message.success(msg);
    } else {
      Message.error(msg);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyText(text);
      showMessage('success', `${label}已复制到剪贴板`);
    } catch (error: any) {
      showMessage('error', `复制失败: ${error.message || '未知错误'}`);
    }
  };

  // 添加自定义信息
  const addCustomInfo = () => {
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

  // 重置表单
  const resetForm = () => {
    setFormData({
      anchorId: '',
      title: '',
      coverUrl: '',
      seatTemplate: 'VideoDynamicGrid9Seats',
      maxSeatCount: 8,
    });
    setCustomInfos([]);
    setCustomInfoExpanded(false);
    setShowSuccess(false);
    setErrorMsg('');
    setSuccessMsg('');
    setUseObsStreaming(false);
    setObsSetupStatus('');
    setObsSetupError('');
    setStreamInfo(null);
    setStreamInfoError('');
    setHasPendingCover(false);
    setAnchorEntrySnapshot(null);
    // 清理 ImageUpload 组件内部状态（取消验证、清理缓存预览）
    coverUploadRef.current?.reset();
  };

  // 关闭弹窗
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 提交表单
  const handleSubmit = async () => {
    // 验证
    if (!formData.anchorId.trim()) {
      showMessage('error', '请输入直播间主播ID');
      return;
    }
    const anchorIdBytes = getByteLength(formData.anchorId);
    if (anchorIdBytes > ANCHOR_ID_MAX_BYTES) {
      showMessage('error', `主播ID不能超过 ${ANCHOR_ID_MAX_BYTES} 字节（当前 ${anchorIdBytes} 字节）`);
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

    setCreating(true);
    setErrorMsg('');
    setObsSetupStatus('');
    setObsSetupError('');

    // 使用 live_ + 主播ID 作为房间ID
    const roomId = `live_${formData.anchorId}`;
    const anchorId = formData.anchorId;

    try {
      // 1. 解析封面 URL（公共逻辑自动处理 URL 验证 / 文件上传 / fallback）
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
        setCreating(false);
        return;
      }

      // 2. 构建创建参数
      const params: any = {
        roomId,
        anchorId,
        title: formData.title,
        seatTemplate: formData.seatTemplate,
      };

      // 传递封面 URL
      if (coverUrl) {
        params.coverUrl = coverUrl;
      }

      // MaxSeatCount 仅在语聊房模板下传递
      if (formData.seatTemplate === 'AudioSalon' || formData.seatTemplate === 'Karaoke') {
        params.maxSeatCount = formData.maxSeatCount;
      }

      // 收集有效的自定义信息
      const validCustomInfos: Record<string, string> = {};
      for (const info of customInfos) {
        const key = info.key.trim();
        if (key) {
          validCustomInfos[key] = info.value;
        }
      }
      if (Object.keys(validCustomInfos).length > 0) {
        params.customInfo = validCustomInfos;
      }

      // OBS 推流标记
      if (useObsStreaming) {
        params.useObsStreaming = true;
      }

      // 3. 调用创建接口
      const response = await createRoom(params);

      if (response.ErrorCode === 0 || response.ErrorCode === undefined) {
        setStreamInfo(null);
        setStreamInfoError('');
        setAnchorEntrySnapshot({ roomId, anchorUserId: anchorId });

        let obsConfiguredSuccessfully = !useObsStreaming;

        // 如果勾选了 OBS 推流，才获取推流信息并配置机器人和上麦
        if (useObsStreaming) {
          // 如果勾选了 OBS 推流，机器人 ID 使用主播 ID + "_obs"
          const robotId = `${anchorId}_obs`;

          // 先获取机器人推流信息（userId 必须是机器人 ID，需要异步获取匹配的 userSig）
          try {
            const pushInfo = await getStreamInfoAsync(roomId, robotId);
            if (pushInfo) {
              setStreamInfo({
                serverUrl: pushInfo.ServerUrl,
                streamKey: pushInfo.StreamKey,
              });
            } else {
              setStreamInfoError('获取推流信息失败');
            }
          } catch (streamError: any) {
            setStreamInfoError(streamError.message || '获取推流信息失败');
          }

          // 配置机器人和上麦
          try {

            // 先检查是否已有机器人
            const robotRes = await getRobotList(roomId);
            const robotList = robotRes.Response?.RobotList_Account || [];
            const hasRobot = robotList.includes(robotId);

            // 检查是否已上麦
            const seatRes = await getSeatList(roomId);
            const seatMembers = new Set<string>();
            seatRes.Response?.SeatList?.forEach((seat: any) => {
              if (seat.Member_Account) seatMembers.add(seat.Member_Account);
            });
            const onSeat = seatMembers.has(robotId);

            if (!hasRobot) {
              setObsSetupStatus('creating');
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
              setObsSetupStatus('seating');
              const seatRes = await pickUserOnSeat(roomId, robotId);
              if (seatRes.ErrorCode !== 0) {
                throw new Error(seatRes.ErrorInfo || '上麦失败');
              }
            }

            setObsSetupStatus('ready');
            obsConfiguredSuccessfully = true;
          } catch (obsError: any) {
            console.error('OBS 设置失败:', obsError);
            setObsSetupStatus('error');
            setObsSetupError(obsError.message || 'OBS 设置失败');
            obsConfiguredSuccessfully = false;
          }
        }

        setShowSuccess(true);
        showMessage('success', useObsStreaming && obsConfiguredSuccessfully ? '直播间创建成功，OBS 已配置' : '直播间创建成功');
      } else {
        showMessage('error', `创建失败: ${response.ErrorInfo || response.ErrorMessage || response.message || '未知错误'}`);
      }
    } catch (error: any) {
      showMessage('error', `请求失败: ${error.message || '网络错误'}`);
    } finally {
      setCreating(false);
    }
  };

  // 完成创建
  const handleComplete = () => {
    resetForm();
    onSuccess();
  };

  const successDescription = (() => {
    if (useObsStreaming) {
      if (obsSetupStatus === '' || obsSetupStatus === 'creating' || obsSetupStatus === 'seating') {
        return {
          text: obsSetupStatus === 'creating'
            ? '正在添加机器人...'
            : obsSetupStatus === 'seating'
              ? '正在上麦...'
              : '正在配置 OBS...',
          error: false,
        };
      }

      if (obsSetupStatus === 'error') {
        return {
          text: `OBS 配置失败：${obsSetupError}`,
          error: true,
        };
      }

      if (streamInfo) {
        return {
          text: 'OBS 已配置完成，可直接复制下方推流信息。',
          error: false,
        };
      }

      if (streamInfoError) {
        return {
          text: `OBS 已配置完成，但推流信息生成失败：${streamInfoError}`,
          error: true,
        };
      }

      return {
        text: 'OBS 已配置完成。',
        error: false,
      };
    }

    if (streamInfo) {
      return {
        text: '推流信息已生成，可直接复制使用。',
        error: false,
      };
    }

    if (streamInfoError) {
      return {
        text: `推流信息生成失败：${streamInfoError}`,
        error: true,
      };
    }

    return {
      text: '',
      error: false,
    };
  })();

  return (
    <Dialog
      visible={visible}
      header={showSuccess ? '创建成功' : '新建直播间'}
      onClose={handleClose}
      width={DIALOG_WIDTH.FORM}
      placement="center"
      className="create-room-modal"
      footer={
        !showSuccess ? (
          <>
            <Button shape="round" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              shape="round"
              theme="primary"
              onClick={handleSubmit}
              loading={creating}
              disabled={creating || !formData.anchorId.trim() || (coverUploadRef.current?.isValidating) || (coverUploadRef.current?.hasUrlError)}
            >
              {creating ? '创建中...' : '创建'}
            </Button>
          </>
        ) : (
          <Button
            shape="round"
            theme="primary"
            onClick={handleComplete}
            disabled={useObsStreaming && (obsSetupStatus === '' || obsSetupStatus === 'creating' || obsSetupStatus === 'seating')}
          >
            {useObsStreaming && obsSetupStatus !== 'ready' && obsSetupStatus !== 'error' ? '配置中...' : '完成'}
          </Button>
        )
      }
    >
      {!showSuccess ? (
        /* 创建表单 */
        <FormLayout className="create-room-form" labelWidth={100}>
          {/* 直播间主播 */}
          <FormField label="直播间主播" requiredMark>
            <div className="form-field__input-wrapper">
              <Input
                value={formData.anchorId}
                onChange={(value) => setFormData(prev => ({ ...prev, anchorId: String(value) }))}
                placeholder="请输入主播ID"
                status={getByteLength(formData.anchorId) > ANCHOR_ID_MAX_BYTES ? 'error' : 'default'}
                suffix={
                  <span className={`input-suffix-count${getByteLength(formData.anchorId) > ANCHOR_ID_MAX_BYTES ? ' byte-overflow' : ''}`}>
                    {getByteLength(formData.anchorId)}/{ANCHOR_ID_MAX_BYTES}
                  </span>
                }
              />
              {getByteLength(formData.anchorId) > ANCHOR_ID_MAX_BYTES && (
                <div className="form-field__error-tip">主播ID不能超过 {ANCHOR_ID_MAX_BYTES} 字节</div>
              )}
            </div>
          </FormField>

          {/* 房间ID - 只读显示 */}
          <FormField label="直播间 ID">
            <Input
              value={formData.anchorId ? `live_${formData.anchorId}` : ''}
              disabled
              readonly
              placeholder="请先输入主播ID，将自动生成直播间ID"
            />
          </FormField>

          {/* 直播间标题 */}
          <FormField label="直播间标题">
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
              aspectRatio={getCoverAspectRatio(formData.seatTemplate)}
              placeholder="点击或拖拽上传封面图片"
              previewHeight={140}
              maxBytes={200}
              deferUpload={uploadEnabled}
              onFileReady={(file) => setHasPendingCover(!!file)}
            />
          </FormField>

          {/* 布局模板 */}
          <FormField label="布局模板" requiredMark help={SEAT_TEMPLATE_OPTIONS.find(o => o.value === formData.seatTemplate)?.desc}>
            <Select
              options={SEAT_TEMPLATE_SELECT_OPTIONS}
              value={formData.seatTemplate}
              onChange={(value) => setFormData(prev => ({ ...prev, seatTemplate: value as SeatTemplate }))}
              style={{ width: '100%' }}
            />
          </FormField>

          {/* 最大麦位数 - 仅语聊房模板显示 */}
          {(formData.seatTemplate === 'AudioSalon' || formData.seatTemplate === 'Karaoke') && (
            <FormField label="最大麦位数" help="语聊房模板可自定义麦位数量，受套餐包限制">
              <InputNumber
                value={formData.maxSeatCount}
                onChange={(value) => setFormData(prev => ({ ...prev, maxSeatCount: Number(value) || 1 }))}
                min={1}
                max={16}
                placeholder="请输入最大麦位数"
                theme="normal"
                allowInputOverLimit
                inputProps={{
                  tips: formData.maxSeatCount < 1 || formData.maxSeatCount > 16 ? '麦位数范围 1-16' : '',
                  status: (formData.maxSeatCount < 1 || formData.maxSeatCount > 16) ? 'error' : 'default',
                }}
                style={{ width: '100%' }}
              />
            </FormField>
          )}

          {/* OBS 推流选项 */}
          <FormField label="推流方式" help="勾选后创建成功将显示 OBS 推流信息">
            <Checkbox
              checked={useObsStreaming}
              onChange={(checked) => setUseObsStreaming(!!checked)}
            >
              使用 OBS 推流
            </Checkbox>
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
      ) : (
        /* 创建成功提示 */
        <div className="create-success-content">
          <div className="create-success-summary">
            <div className="create-success-icon">
              {obsSetupStatus === 'error' ? (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#FFEBEE" />
                  <path d="M16 16L32 32M32 16L16 32" stroke="#F44336" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : useObsStreaming && (obsSetupStatus === '' || obsSetupStatus === 'creating' || obsSetupStatus === 'seating') ? (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#E3F2FD" />
                  <circle cx="24" cy="24" r="8" stroke="#2196F3" strokeWidth="3" fill="none" />
                  <path d="M24 8V16M24 32V40M8 24H16M32 24H40" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#E8F5E9" />
                  <path d="M14 24L21 31L34 18" stroke="#07C160" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <h3>直播间创建成功</h3>
            {successDescription.text && (
              <p className={`create-success-description${successDescription.error ? ' is-error' : ''}`}>
                {successDescription.text}
              </p>
            )}
          </div>

          {anchorEntrySnapshot && (
            <div className="create-success-section create-success-anchor-entry">
              <div className="create-success-section-title">主播入口（预览）</div>
              <p className="create-success-anchor-entry-hint">
                将下列链接发给主播；页面为同仓占位，开播能力待后续接入。主播账号需由服务端{' '}
                <code>/api/get_user_sig</code> 按 <code>anchorUserId</code> 签发 UserSig。
              </p>
              <div className="stream-info-item">
                <div className="stream-info-label">
                  <span>占位 URL</span>
                  <Button
                    variant="text"
                    size="small"
                    icon={<FileCopyIcon size={14} />}
                    onClick={() =>
                      handleCopy(
                        buildAnchorLiveEntryUrl(anchorEntrySnapshot.roomId, anchorEntrySnapshot.anchorUserId),
                        '主播入口链接'
                      )
                    }
                  >
                    复制
                  </Button>
                </div>
                <code className="stream-info-value create-success-anchor-entry-url">
                  {buildAnchorLiveEntryUrl(anchorEntrySnapshot.roomId, anchorEntrySnapshot.anchorUserId)}
                </code>
              </div>
            </div>
          )}

          {streamInfo && (
            <div className="create-success-section">
              <div className="create-success-section-title">推流信息</div>
              <div className="stream-info-items">
                <div className="stream-info-item">
                  <div className="stream-info-label">
                    <span>服务器地址</span>
                    <Button variant="text" size="small" icon={<FileCopyIcon size={14} />} onClick={() => handleCopy(streamInfo.serverUrl, '服务器地址')}>
                      复制
                    </Button>
                  </div>
                  <code className="stream-info-value">{streamInfo.serverUrl}</code>
                </div>
                <div className="stream-info-item">
                  <div className="stream-info-label">
                    <span>推流码</span>
                    <Button variant="text" size="small" icon={<FileCopyIcon size={14} />} onClick={() => handleCopy(streamInfo.streamKey, '推流码')}>
                      复制
                    </Button>
                  </div>
                  <code className="stream-info-value">{streamInfo.streamKey}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
