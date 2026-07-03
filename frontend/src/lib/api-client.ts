import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  withCredentials: true,
});

const AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH = ["/auth/login/", "/auth/refresh/"];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh/")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.response?.config as RetriableConfig | undefined;
    const isAuthEndpoint = AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH.some((path) =>
      config?.url?.includes(path),
    );

    if (error.response?.status === 401 && config && !config._retry && !isAuthEndpoint) {
      config._retry = true;
      try {
        await refreshAccessToken();
        return apiClient(config);
      } catch {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (!data) return fallback;

    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.non_field_errors) && typeof data.non_field_errors[0] === "string") {
      return data.non_field_errors[0];
    }
    const firstFieldError = Object.values(data).find(
      (value) => Array.isArray(value) && typeof value[0] === "string",
    ) as string[] | undefined;
    if (firstFieldError) return firstFieldError[0];
  }
  return fallback;
}
