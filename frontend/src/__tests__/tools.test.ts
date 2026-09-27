import { afterEach, describe, expect, it, vi } from 'vitest';
import { limits, snapKernel } from '../config/limits.ts';
import { ApiError } from '../contracts/errors.ts';
import { toolResultPath, toolsService, toolsUnavailable } from '../services/toolsService.ts';

describe('snapKernel', () => {
  const { min, max } = limits.sketchBlur;

  // OpenCV's GaussianBlur raises on an even kernel, which reaches the person as a 500.
  it('only ever produces an odd size inside the range', () => {
    for (let v = min - 10; v <= max + 10; v += 0.5) {
      const out = snapKernel(v);
      expect(out % 2).toBe(1);
      expect(out).toBeGreaterThanOrEqual(min);
      expect(out).toBeLessThanOrEqual(max);
    }
  });

  it('keeps the sizes the spec names', () => {
    for (const v of [15, 21, 31]) expect(snapKernel(v)).toBe(v);
  });

  it('falls back to the default for something that is not a number', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(snapKernel(v)).toBe(limits.sketchBlur.default);
  });
});

describe('toolResultPath', () => {
  it('accepts the relative path the spec returns', () => {
    expect(toolResultPath('/api/tools/results/sketch_550e8400.png')).toBe('/api/tools/results/sketch_550e8400.png');
  });

  // The backend may name itself by a LAN address this browser does not use.
  it('reduces an absolute URL to its path', () => {
    expect(toolResultPath('http://192.168.1.20:8000/api/tools/results/mask_1122.png')).toBe(
      '/api/tools/results/mask_1122.png',
    );
  });

  // The token is attached to whatever this returns, so nothing else may pass.
  it('refuses anything that is not a plain file under the results prefix', () => {
    for (const url of [
      '/generations/abc/image',
      '/uploads/a.png',
      '/api/tools/results/',
      '/api/tools/results/../../generations/abc/image',
      '/api/tools/results/%2e%2e%2fsecret',
      '/api/tools/results/sub/dir.png',
      '/api/tools/results/.hidden',
      '/api/tools/resultsX/a.png',
    ]) {
      expect(toolResultPath(url), url).toBeNull();
    }
  });

  it('never lets the fetch go out for a refused URL', async () => {
    await expect(toolsService.fetchResult('/uploads/a.png')).rejects.toThrow();
  });
});

describe('toolsUnavailable', () => {
  it('reads 404 and 405 as "not on this server"', () => {
    expect(toolsUnavailable(new ApiError({ status: 404, message: '' }))).toBe(true);
    expect(toolsUnavailable(new ApiError({ status: 405, message: '' }))).toBe(true);
  });

  it('leaves real failures and anything else alone', () => {
    for (const status of [0, 400, 401, 422, 500]) {
      expect(toolsUnavailable(new ApiError({ status, message: '' }))).toBe(false);
    }
    expect(toolsUnavailable(new Error('boom'))).toBe(false);
  });
});

/** Just enough XMLHttpRequest to see what a tool call sends. */
class FakeXhr {
  static last: FakeXhr | null = null;
  method = '';
  url = '';
  body: FormData | null = null;
  status = 200;
  responseText = '{"success":true}';
  upload = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  abort() {}
  send(body: FormData) {
    this.body = body;
    FakeXhr.last = this;
    queueMicrotask(() => this.onload?.());
  }
}

describe('toolsService requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXhr.last = null;
  });

  const image = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

  it('uploads the image as `file` and snaps the sketch kernel', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    await toolsService.sketch(image, 20);
    const sent = FakeXhr.last!;
    expect(sent.method).toBe('POST');
    expect(new URL(sent.url).pathname).toBe('/api/tools/sketch');
    expect(sent.body!.get('file')).toBeInstanceOf(Blob);
    expect(sent.body!.get('blur_ksize')).toBe('21');
    expect(sent.body!.has('image_url')).toBe(false);
  });

  it('sends the colour the splash should keep', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    await toolsService.colorSplash(image, 'red');
    expect(new URL(FakeXhr.last!.url).pathname).toBe('/api/tools/color-splash');
    expect(FakeXhr.last!.body!.get('target_color')).toBe('red');
  });

  it('sends nothing but the image to the tools that take no options', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    for (const [call, path] of [
      [() => toolsService.pose(image), '/api/tools/pose'],
      [() => toolsService.removeBg(image), '/api/tools/remove-bg'],
    ] as const) {
      await call();
      expect(new URL(FakeXhr.last!.url).pathname).toBe(path);
      expect([...FakeXhr.last!.body!.keys()]).toEqual(['file']);
    }
  });
});
