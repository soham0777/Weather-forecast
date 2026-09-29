import axios from 'axios';

const TOKEN_KEY = 'cims.token';

/** API base URL comes from VITE_API_BASE_URL (see .env.example); never hard-coded. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { Accept: 'application/json' },
});

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) — token lives only in memory */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let unauthorizedHandler = null;
/** Registered by AuthContext: called when the API reports the session is no longer valid. */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    if (status === 401 && !url.includes('/auth/login') && unauthorizedHandler) {
      unauthorizedHandler(error.response?.data?.message);
    }
    return Promise.reject(error);
  },
);

/** Unwraps the {success, message, data} envelope. */
export const unwrap = (response) => response.data?.data;

/** Human-readable message for any API/network error. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (error?.request && !error.response) return 'Cannot reach the server. Check your internet connection and try again.';
  return fallback;
}

/** Field-level validation messages ({field: message}) from a 422 response. */
export function getFieldErrors(error) {
  return error?.response?.data?.errors || {};
}

/** Removes empty values so they are not sent as query parameters. */
export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

/** Opens an authenticated PDF (resume) in a new tab. */
export async function openPdf(path) {
  const win = window.open('', '_blank');
  try {
    const response = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    if (win) {
      win.location.href = url;
    } else {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (win) win.close();
    let message = 'The file could not be opened.';
    if (error?.response?.data instanceof Blob) {
      try {
        message = JSON.parse(await error.response.data.text()).message || message;
      } catch {
        /* keep default */
      }
    }
    throw new Error(message, { cause: error });
  }
}

export default api;
