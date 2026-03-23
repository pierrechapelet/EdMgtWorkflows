import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const API_PREFIX = '/api/v1';

/**
 * Typed Axios instance for the EdMgtWorkflows API.
 * Automatically attaches the Bearer token from sessionStorage.
 * Handles 401 → token refresh → retry once.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${BASE_URL}${API_PREFIX}`,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  // ── Request interceptor: attach access token ──────────────────────────────
  client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  // ── Response interceptor: handle 401 + token refresh ─────────────────────
  let isRefreshing = false;
  let refreshQueue: Array<(token: string) => void> = [];

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const err = error as {
        response?: { status?: number };
        config?: AxiosRequestConfig & { _retry?: boolean };
      };

      if (err.response?.status === 401 && !err.config?._retry) {
        if (isRefreshing) {
          // Queue this request until refresh completes
          return new Promise((resolve) => {
            refreshQueue.push((newToken: string) => {
              if (err.config) {
                err.config.headers = {
                  ...err.config.headers,
                  Authorization: `Bearer ${newToken}`,
                };
                resolve(client(err.config));
              }
            });
          });
        }

        if (err.config) {
          err.config._retry = true;
          isRefreshing = true;

          try {
            const refreshToken = typeof window !== 'undefined'
              ? localStorage.getItem('refresh_token')
              : null;

            if (!refreshToken) throw new Error('No refresh token');

            const { data } = await client.post<{
              data: { accessToken: string; refreshToken: string };
            }>('/auth/refresh', { refreshToken });

            const newAccessToken = data.data.accessToken;
            sessionStorage.setItem('access_token', newAccessToken);
            localStorage.setItem('refresh_token', data.data.refreshToken);

            refreshQueue.forEach((cb) => cb(newAccessToken));
            refreshQueue = [];

            err.config.headers = {
              ...err.config.headers,
              Authorization: `Bearer ${newAccessToken}`,
            };
            return client(err.config);
          } catch {
            // Refresh failed — clear tokens and redirect to login
            sessionStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            refreshQueue = [];
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          } finally {
            isRefreshing = false;
          }
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const apiClient = createApiClient();
