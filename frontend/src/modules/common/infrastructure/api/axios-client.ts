import { type ApiResponse } from '@/types/ApiResponse';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

export class AxiosClient {
  private readonly axios: AxiosInstance;
  private static readonly CACHE_TTL_MS = 30_000;
  private static readonly responseCache = new Map<string, { expiresAt: number; value: unknown }>();
  private static readonly inflightGets = new Map<string, Promise<unknown>>();

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

      const activeLocale =
        typeof window === 'undefined'
          ? undefined
          : window.location.pathname.match(/^\/(en|dr|ps)(?:\/|$)/)?.[1];
      if (activeLocale) {
        config.headers['X-App-Locale'] = activeLocale;
      }

      return config;
    });
  }

  private buildCacheKey(url: string, config?: AxiosRequestConfig): string {
    return this.axios.getUri({
      ...config,
      method: 'get',
      url,
    });
  }

  private static clearExpiredCacheEntries(): void {
    const now = Date.now();
    for (const [key, entry] of AxiosClient.responseCache.entries()) {
      if (entry.expiresAt <= now) {
        AxiosClient.responseCache.delete(key);
      }
    }
  }

  private static invalidateCache(): void {
    AxiosClient.responseCache.clear();
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    if (typeof window === 'undefined') {
      const response = await this.axios.get<ApiResponse<T>>(url, config);
      return response.data;
    }

    AxiosClient.clearExpiredCacheEntries();

    const cacheKey = this.buildCacheKey(url, config);
    const cached = AxiosClient.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as ApiResponse<T>;
    }

    const inflight = AxiosClient.inflightGets.get(cacheKey);
    if (inflight) {
      return inflight as Promise<ApiResponse<T>>;
    }

    const request = this.axios
      .get<ApiResponse<T>>(url, config)
      .then((response) => {
        AxiosClient.responseCache.set(cacheKey, {
          expiresAt: Date.now() + AxiosClient.CACHE_TTL_MS,
          value: response.data,
        });
        return response.data;
      })
      .finally(() => {
        AxiosClient.inflightGets.delete(cacheKey);
      });

    AxiosClient.inflightGets.set(cacheKey, request);
    return request;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.post<ApiResponse<T>>(url, data, config);
    AxiosClient.invalidateCache();
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.put<ApiResponse<T>>(url, data, config);
    AxiosClient.invalidateCache();
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.delete<ApiResponse<T>>(url, config);
    AxiosClient.invalidateCache();
    return response.data;
  }
}
