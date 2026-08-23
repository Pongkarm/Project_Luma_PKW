/**
 * The one place the access token is kept.
 *
 * The API issues a single bearer token with no refresh companion, and its CORS
 * setup pairs `allow_origins: ["*"]` with `allow_credentials: true` — a
 * combination browsers reject for credentialed requests — so a cookie session
 * is not an option here. The token travels as an Authorization header.
 *
 * apiClient reads from this module and the session store writes to it; no
 * component touches it directly.
 */
const STORAGE_KEY = 'luma.token';

let token: string | null = readFromStorage();

function readFromStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — the session simply does not survive a reload */
  }
}

type UnauthorizedListener = () => void;
const listeners = new Set<UnauthorizedListener>();

/** Fired when the server rejects a token we believed was good. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthorized(): void {
  for (const listener of listeners) listener();
}
