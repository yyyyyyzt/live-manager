/**
 * 共享 HTTP 客户端
 *
 * 设计：提供工厂函数，让各前端项目注入自己的 axios 实例。
 * 这样 baseURL、拦截器、登录跳转等框架相关逻辑保留在各项目中，
 * 共享包只使用注入的 HTTP 方法。
 */
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// 全局 HTTP 客户端实例
let _httpClient: AxiosInstance | null = null;

/**
 * 初始化共享 HTTP 客户端（每个前端项目启动时调用一次）
 */
export function initHttpClient(client: AxiosInstance): void {
  _httpClient = client;
}

/**
 * 获取当前 HTTP 客户端实例
 */
export function getHttpClient(): AxiosInstance {
  if (!_httpClient) {
    throw new Error(
      '[@live-manager/common] HTTP client not initialized. Call initHttpClient() first.'
    );
  }
  return _httpClient;
}

// 通用请求方法（代理到注入的 axios 实例）
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  return getHttpClient().request<T, T>(config);
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
