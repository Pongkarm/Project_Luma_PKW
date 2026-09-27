import { requestBlob, uploadMultipart, type UploadProgress } from './apiClient.ts';
import { env } from '../config/env.ts';
import { snapKernel } from '../config/limits.ts';
import { isApiError } from '../contracts/errors.ts';
import {
  TOOL_RESULTS_PREFIX,
  type ColorSplashResponse,
  type PoseResponse,
  type RemoveBgResponse,
  type SketchResponse,
  type SplashColor,
} from '../contracts/tools.ts';

type Handlers = { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal };

/**
 * The image always travels as the multipart `file`, never as `image_url`.
 *
 * The spec lets a tool resolve a server path instead, but it does not say
 * whether /api/tools/results/… is one it accepts — and running a second tool on
 * the first one's output is the whole point of the studio. The bytes are
 * already in the browser, because they had to be fetched to be shown. It also
 * means a 404 can only be the endpoint itself: there is no path left to miss.
 */
function run<T>(tool: string, image: Blob, fields: Record<string, string>, handlers: Handlers): Promise<T> {
  return uploadMultipart<T>(`/api/tools/${tool}`, image, 'source.png', { ...handlers, fields });
}

/**
 * The server path of a tool output, or null if it is not one.
 *
 * The response hands back a URL the app then fetches, so it is checked before
 * the bearer token goes anywhere near it: it has to be a bare file name under
 * the results prefix. An absolute URL is reduced to its path and sent to the
 * configured backend — the server may name itself by a LAN address this
 * browser does not use.
 */
export function toolResultPath(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url, env.apiBaseUrl).pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(TOOL_RESULTS_PREFIX)) return null;
  const name = pathname.slice(TOOL_RESULTS_PREFIX.length);
  // No separators, no encoded characters, no leading dot: a plain file name.
  return /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name) ? pathname : null;
}

/**
 * True when the tools endpoints are not on this backend at all.
 *
 * Because the image is always uploaded rather than referenced, a tool POST has
 * no "image not found" 404 to confuse this with. 405 covers a server whose
 * catch-all route answers the path but not the method.
 */
export function toolsUnavailable(error: unknown): boolean {
  return isApiError(error) && (error.status === 404 || error.status === 405);
}

export const toolsService = {
  /** POST /api/tools/pose — skeleton overlay plus the 33 landmarks. */
  pose(image: Blob, handlers: Handlers = {}): Promise<PoseResponse> {
    return run<PoseResponse>('pose', image, {}, handlers);
  },

  /** POST /api/tools/sketch — pencil line-art. The kernel is snapped to an odd size first. */
  sketch(image: Blob, blurKsize: number, handlers: Handlers = {}): Promise<SketchResponse> {
    return run<SketchResponse>('sketch', image, { blur_ksize: String(snapKernel(blurKsize)) }, handlers);
  },

  /** POST /api/tools/color-splash — keeps one hue, greys out the rest. */
  colorSplash(image: Blob, targetColor: SplashColor, handlers: Handlers = {}): Promise<ColorSplashResponse> {
    return run<ColorSplashResponse>('color-splash', image, { target_color: targetColor }, handlers);
  },

  /** POST /api/tools/remove-bg — a transparent PNG and the mask it was cut with. */
  removeBg(image: Blob, handlers: Handlers = {}): Promise<RemoveBgResponse> {
    return run<RemoveBgResponse>('remove-bg', image, {}, handlers);
  },

  /**
   * GET /api/tools/results/{filename} — the spec leaves this open, but the
   * output is fetched rather than linked anyway: it is the input to the next
   * tool, and a cross-origin <a download> ignores the file name it is given.
   * Rejects a URL toolResultPath() does not accept.
   */
  fetchResult(url: string, signal?: AbortSignal): Promise<Blob> {
    const path = toolResultPath(url);
    if (!path) return Promise.reject(new Error(`Not a tool result: ${url}`));
    return requestBlob(path, { signal });
  },
};
