import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { initHttpClient, initAegis, getErrorMessage, getUrlOverrideParams, isServerConfigured } from '@live-manager/common';

// API 基础配置
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// 创建 axios 实例
const httpClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
httpClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data);
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // URL 有参数 → 优先使用 URL 参数
    const urlOverride = getUrlOverrideParams();
    if (urlOverride) {
      console.log(`[Interceptor] URL 覆盖模式: sdkAppId=${urlOverride.sdkAppId}`);
      
      // 检查 localStorage 中的 sdkAppId 是否匹配（参数可能变化）
      const storedSdkAppId = localStorage.getItem('sdk_app_id');
      const userId = localStorage.getItem('user_id');
      const userSig = localStorage.getItem('user_sig');
      
      if (storedSdkAppId !== String(urlOverride.sdkAppId)) {
        // sdkAppId 变化 → 清除旧凭证，需要重新初始化 SDK
        console.log(`[Interceptor] sdkAppId 变化: ${storedSdkAppId} -> ${urlOverride.sdkAppId}，清除旧凭证`);
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_sig');
        localStorage.removeItem('sdk_app_id');
      }
      
      config.headers['x-sdk-app-id'] = String(urlOverride.sdkAppId);
      config.headers['x-user-id'] = userId || '';
      config.headers['x-user-sig'] = userSig || '';
      return config;
    }

    // URL 无参数 → 清除可能存在的 URL override 凭证，避免影响服务器配置模式
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_sig');
    localStorage.removeItem('sdk_app_id');

    // URL 无参数 → 检查是否服务器配置模式
    const configured = isServerConfigured();
    if (!configured) {
      // 非服务器配置模式，从 localStorage 读取凭证
      const sdkAppId = localStorage.getItem('sdk_app_id');
      const userId = localStorage.getItem('user_id');
      const userSig = localStorage.getItem('user_sig');
      console.log(`[Interceptor] 非服务器配置模式: sdkAppId=${sdkAppId}, userId=${userId}`);
      if (sdkAppId) config.headers['x-sdk-app-id'] = sdkAppId;
      if (userId) config.headers['x-user-id'] = userId;
      if (userSig) config.headers['x-user-sig'] = userSig;
    }

    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
httpClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data as { code?: number; ErrorCode?: number; message?: string; ErrorMessage?: string; data?: unknown };

    // TRTC 代理响应：直接透传
    const requestUrl = response.config?.url || '';
    if (requestUrl.includes('/trtc_proxy')) {
      return data as unknown as AxiosResponse;
    }

    // 检查业务状态码
    const errorCode = data.code ?? data.ErrorCode;
    if (errorCode !== undefined && errorCode !== 0) {
      // 优先使用 ErrorCode 映射，否则使用原始 ErrorInfo/ErrorMessage
      const rawMsg = data.message || data.ErrorMessage || '请求失败';
      const friendlyMsg = getErrorMessage(errorCode, rawMsg, undefined);
      console.error(`API Error [code ${errorCode}]:`, friendlyMsg);
      // 将错误码附加到 Error 对象上，方便调用方获取
      const error = new Error(friendlyMsg);
      (error as any).ErrorCode = errorCode;
      return Promise.reject(error);
    }

    return data as unknown as AxiosResponse;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      console.error(`API Error [${status}]:`, data?.message || error.message);

      if (status === 401) {
        console.warn('API 401 Unauthorized - 跳转登录');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_sig');
        localStorage.removeItem('sdk_app_id');
        localStorage.removeItem('server_configured');
        window.location.href = '/#/login';
      }
    } else {
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// 初始化共享包的 HTTP 客户端
initHttpClient(httpClient);

// 初始化 Aegis 监控
initAegis({
  id: 'LlKbmtj1zyLVD2Pjoq',
  reportApiSpeed: true,
  reportAssetSpeed: true,
  spa: true,
  autoUpdateUin: true,
});
console.log('[Aegis] initialized');

// 通用请求方法（保留供项目特有逻辑使用）
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  return httpClient.request<T, T>(config);
}

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'GET', url, params });
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  return request<T>({ method: 'POST', url, data });
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  return request<T>({ method: 'PUT', url, data });
}

export async function del<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'DELETE', url, params });
}

export default httpClient;
