import axios from 'axios';
import { get, getHttpClient } from './client';
import type { UploadConfig, UploadResult } from './types';

function getUploadErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (responseData && typeof responseData === 'object') {
      const message = (responseData as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '上传失败';
}

/**
 * 获取上传配置
 */
export async function getUploadConfig(): Promise<UploadConfig> {
  const response = await get<{ code: number; message: string; data: UploadConfig }>('/upload/config');
  return (response as any).data;
}

/**
 * 上传图片
 */
export async function uploadImage(
  file: File | Blob,
  type: 'cover' | 'gift-icon' | 'gift-animation' = 'cover',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  // 从注入的 httpClient 获取 baseURL
  const client = getHttpClient();
  const baseURL = client.defaults.baseURL || '';
  const token = localStorage.getItem('auth_token');

  try {
    const response = await axios.post<{ code: number; message: string; data: UploadResult }>(
      `${baseURL}/upload/image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 60000,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      },
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message || '上传失败');
    }

    return response.data.data;
  } catch (error) {
    throw new Error(getUploadErrorMessage(error));
  }
}
