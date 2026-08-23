/**
 * Runtime configuration. The base URL is the ONLY place the backend's origin
 * is written down; nothing else in the app knows where Node 2 lives.
 */
const rawBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const env = {
  /** Backend (Node 2) origin, without a trailing slash. */
  apiBaseUrl: rawBase.replace(/\/+$/, ''),
  isDev: import.meta.env.DEV,
} as const;
