import { env } from '../config/env.ts';
import { ApiError, type FieldError } from '../contracts/errors.ts';
import { emitUnauthorized, getToken } from './tokenStore.ts';
import { translate, type Language } from '../config/i18n.ts';

/**
 * Errors are produced outside React, so the language is read from <html lang>
 * — the same value the app sets when someone switches language.
 */
function currentLanguage(): Language {
  return document.documentElement.lang === 'th' ? 'th' : 'en';
}

type Body =
  | { kind: 'json'; value: unknown }
  | { kind: 'form'; value: Record<string, string> }
  | { kind: 'none' };

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  json?: unknown;
  /** Sent as application/x-www-form-urlencoded — the login endpoint needs this. */
  form?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  /** Attach the bearer token. Default true. */
  auth?: boolean;
  /**
   * Suppress the global "session expired" signal for this call. Set on sign-in,
   * where a 401 means "wrong password", not "your session ended".
   */
  quiet401?: boolean;
  signal?: AbortSignal;
};

export function apiUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildBody(options: RequestOptions): Body {
  if (options.form) return { kind: 'form', value: options.form };
  if (options.json !== undefined) return { kind: 'json', value: options.json };
  return { kind: 'none' };
}

/** FastAPI speaks two `detail` dialects: a string, or a validation array. */
function parseErrorPayload(payload: unknown): { detail: string | null; fieldErrors: FieldError[] } {
  if (!payload || typeof payload !== 'object') return { detail: null, fieldErrors: [] };
  const detail = (payload as { detail?: unknown }).detail;

  if (typeof detail === 'string') return { detail, fieldErrors: [] };

  if (Array.isArray(detail)) {
    const fieldErrors: FieldError[] = [];
    for (const entry of detail) {
      if (!entry || typeof entry !== 'object') continue;
      const loc = (entry as { loc?: unknown }).loc;
      const msg = (entry as { msg?: unknown }).msg;
      const path = Array.isArray(loc)
        ? loc.filter((part) => part !== 'body' && part !== 'query').join('.')
        : '';
      fieldErrors.push({ field: path, message: typeof msg === 'string' ? msg : 'Invalid value' });
    }
    const first = fieldErrors[0];
    return { detail: first ? first.message : null, fieldErrors };
  }

  return { detail: null, fieldErrors: [] };
}

/** One sentence per status, in the language the person is using. */
function messageForStatus(status: number, detail: string | null): string {
  const language = currentLanguage();
  switch (status) {
    case 400:
      return detail ?? translate(language, 'error.400');
    case 401:
      return translate(language, 'error.401');
    case 403:
      return translate(language, 'error.403');
    case 404:
      return translate(language, 'error.404');
    case 413:
      return translate(language, 'error.413');
    case 415:
      return translate(language, 'error.415');
    case 422:
      return detail ?? translate(language, 'error.422');
    case 500:
    case 502:
    case 503:
      return translate(language, 'error.500');
    default:
      return detail ?? translate(language, 'error.generic', { status });
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* an empty or non-JSON error body is fine — the status still carries meaning */
  }
  const { detail, fieldErrors } = parseErrorPayload(payload);
  return new ApiError({
    status: response.status,
    message: messageForStatus(response.status, detail),
    detail,
    fieldErrors,
  });
}

function networkError(cause: unknown): ApiError {
  const aborted = cause instanceof DOMException && cause.name === 'AbortError';
  return new ApiError({
    status: 0,
    message: translate(currentLanguage(), aborted ? 'error.aborted' : 'error.network'),
    isNetworkError: true,
  });
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers();
  const body = buildBody(options);
  let payload: BodyInit | undefined;

  if (body.kind === 'json') {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body.value);
  } else if (body.kind === 'form') {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    payload = new URLSearchParams(body.value).toString();
  }

  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: payload,
      signal: options.signal,
    });
  } catch (cause) {
    throw networkError(cause);
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.isUnauthorized && !options.quiet401) emitUnauthorized();
    throw error;
  }

  return response;
}

/** JSON request. Throws ApiError on any failure. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Request with no response body of interest (HEAD, or a bare 200). */
export async function requestOk(path: string, options: RequestOptions = {}): Promise<boolean> {
  await send(path, options);
  return true;
}

/** Fetch bytes from an authenticated endpoint. */
export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options);
  return response.blob();
}

/**
 * Fetch an image that sits behind authentication and hand back an object URL.
 *
 * GET /generations/{id}/image requires the bearer token, so a plain <img src>
 * would get a 401. The caller owns the returned URL and must revoke it.
 */
export async function requestObjectUrl(
  path: string,
  options: RequestOptions = {},
): Promise<{ url: string; revoke: () => void }> {
  const blob = await requestBlob(path, options);
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export type UploadProgress = { loaded: number; total: number; ratio: number };

/**
 * Multipart upload with real progress.
 *
 * fetch() cannot report request progress in browsers, and an upload of up to
 * 10 MB over the studio LAN deserves a truthful bar rather than a spinner, so
 * this one call uses XHR.
 */
export function uploadMultipart<T>(
  path: string,
  file: Blob,
  fileName: string,
  handlers: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, fileName);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(path));

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!handlers.onProgress || !event.lengthComputable) return;
      handlers.onProgress({
        loaded: event.loaded,
        total: event.total,
        ratio: event.total > 0 ? event.loaded / event.total : 0,
      });
    };

    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as T);
        return;
      }
      const { detail, fieldErrors } = parseErrorPayload(payload);
      const error = new ApiError({
        status: xhr.status,
        message: messageForStatus(xhr.status, detail),
        detail,
        fieldErrors,
      });
      if (error.isUnauthorized) emitUnauthorized();
      reject(error);
    };

    xhr.onerror = () => reject(networkError(null));
    xhr.onabort = () =>
      reject(
        new ApiError({
          status: 0,
          message: translate(currentLanguage(), 'error.aborted'),
          isNetworkError: true,
        }),
      );

    handlers.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
