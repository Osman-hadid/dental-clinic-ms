import { type ApiResponse } from '@/types/ApiResponse';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

export class AxiosClient {
  private readonly axios: AxiosInstance;

  private static resolveDefaultBaseUrl(): string {
    if (typeof window === 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    }

    const { hostname, origin, port, protocol } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalHost && port === '3000') {
      return `${protocol}//${hostname}:8000`;
    }

    return origin;
  }

  constructor(baseURL?: string) {
    const resolvedBaseUrl = baseURL ?? AxiosClient.resolveDefaultBaseUrl();

    this.axios = axios.create({
      baseURL: resolvedBaseUrl,
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    });

    this.axios.interceptors.request.use((config) => {
      const token = Cookies.get('XSRF-TOKEN');
      if (token) {
        config.headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
      }

      if (!config.headers['X-Request-Id']) {
        config.headers['X-Request-Id'] =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      return config;
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}
