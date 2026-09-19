/// <reference types="vite/client" />s
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// ─── Token storage ────────────────────────────────────────────────────────────
// Access token is in memory (not localStorage) to reduce XSS risk.
// Refresh token is in a secure httpOnly cookie (set by the server) or,
// in this dev setup, in localStorage with a clear comment that it must
// be moved to httpOnly cookies in production.

let inMemoryAccessToken: string | null = null;

export const tokenStore = {
  setAccessToken: (token: string | null) => {
    inMemoryAccessToken = token;
  },
  getAccessToken: () => inMemoryAccessToken,
  getRefreshToken: () => localStorage.getItem('financeos_refresh_token'),
  setRefreshToken: (token: string | null) => {
    if (token) {
      localStorage.setItem('financeos_refresh_token', token);
    } else {
      localStorage.removeItem('financeos_refresh_token');
    }
  },
  getTenantSlug: () => localStorage.getItem('financeos_tenant_slug'),
  setTenantSlug: (slug: string | null) => {
    if (slug) {
      localStorage.setItem('financeos_tenant_slug', slug);
    } else {
      localStorage.removeItem('financeos_tenant_slug');
    }
  },
  clear: () => {
    inMemoryAccessToken = null;
    localStorage.removeItem('financeos_refresh_token');
    localStorage.removeItem('financeos_tenant_slug');
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Request interceptor — attach auth headers
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const tenantSlug = tokenStore.getTenantSlug();
  if (tenantSlug) {
    config.headers['X-Tenant-Slug'] = tenantSlug;
  }

  config.headers['X-Correlation-ID'] = uuidv4();

  return config;
});

// Response interceptor — handle 401 with token refresh
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = tokenStore.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefresh } = data.data!;
        tokenStore.setAccessToken(accessToken);
        tokenStore.setRefreshToken(newRefresh);

        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        tokenStore.clear();
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Typed helper ─────────────────────────────────────────────────────────────

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url, { params });
  return data.data as T;
}

export async function apiPost<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(url, body, { headers });
  return data.data as T;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<ApiResponse<T>>(url, body);
  return data.data as T;
}

export async function apiDelete<T = void>(url: string): Promise<T> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data.data as T;
}
