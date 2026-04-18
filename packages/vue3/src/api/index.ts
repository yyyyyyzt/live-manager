// 必须首先导入 client，确保 initHttpClient 被调用
import './client';

export * from './room';
export * from './auth';
export * from './chat';
export * from './stats';
export * from './gift';
export { default as httpClient } from './client';

// 从共享包导出 TRTC 客户端
export { TRTCApi, trtcRequest, checkTRTCResponse, getSdkAppId, getCurrentUserId, getCurrentUserSig } from '@live-manager/common';
export type { TRTCResponse } from '@live-manager/common';

// 从共享包导出上传
export { getUploadConfig, uploadImage } from '@live-manager/common';
export type { UploadConfig, UploadResult } from '@live-manager/common';
