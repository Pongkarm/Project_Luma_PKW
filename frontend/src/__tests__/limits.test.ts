import { describe, expect, it } from 'vitest';
import { fitToEngine, limits, needsDownscale, resizeKind, sizePresets, snapDimension } from '../config/limits.ts';

const { min, max } = limits.dimension;

describe('snapDimension', () => {
  it('clamps to the engine range', () => {
    expect(snapDimension(1)).toBe(min);
    expect(snapDimension(9999)).toBe(max);
  });

  it('always lands on a multiple of 8', () => {
    for (let v = min - 40; v <= max + 40; v += 1) {
      expect(snapDimension(v) % 8).toBe(0);
    }
  });

  // NaN is the case that mattered: Math.min/Math.max propagate it rather than
  // clamping, so a half-typed size field used to reach the request as NaN.
  it('never leaves the range, whatever it is handed', () => {
    for (const v of [NaN, Infinity, -Infinity, -1, 0, 0.5, 1e9, -1e9]) {
      const out = snapDimension(v);
      expect(out).toBeGreaterThanOrEqual(min);
      expect(out).toBeLessThanOrEqual(max);
    }
  });
});

describe('fitToEngine', () => {
  // This is the one that caused a real 422: an upload is allowed up to 4096px
  // and its raw size was being forwarded to an engine that accepts 256-768.
  it('brings an oversized upload inside the range', () => {
    const { width, height } = fitToEngine(4096, 2160);
    expect(width).toBeLessThanOrEqual(max);
    expect(height).toBeLessThanOrEqual(max);
    expect(width % 8).toBe(0);
    expect(height % 8).toBe(0);
  });

  it('keeps the aspect ratio for shapes the range can express', () => {
    for (const [w, h] of [[4096, 2160], [3000, 3000], [1920, 1080], [1536, 768]]) {
      const fitted = fitToEngine(w, h);
      const before = w / h;
      const after = fitted.width / fitted.height;
      expect(Math.abs(after - before) / before).toBeLessThan(0.06);
    }
  });

  // 256-768 cannot express 1:9, so something has to give. This records what
  // gives, so a future change to the range does not silently alter it.
  it('trades the ratio away rather than leaving the range', () => {
    const fitted = fitToEngine(100, 900);
    expect(fitted).toEqual({ width: min, height: max });
  });

  it('leaves a size that already fits alone', () => {
    expect(fitToEngine(512, 512)).toEqual({ width: 512, height: 512 });
  });
});

describe('resizeKind', () => {
  // needsDownscale answers only half the question — the range has a floor too.
  // An image under 256px is resized as well, and reporting that as "matches
  // your image" was a lie the panel used to tell.
  it('agrees with fitToEngine in every direction', () => {
    for (const [w, h] of [[512, 512], [4096, 4096], [768, 768], [769, 768], [255, 255], [100, 100]]) {
      const fitted = fitToEngine(w, h);
      const changed = fitted.width !== w || fitted.height !== h;
      expect(resizeKind(w, h) !== 'none').toBe(changed);
    }
  });

  it('names the direction', () => {
    expect(resizeKind(4096, 4096)).toBe('down');
    expect(resizeKind(100, 100)).toBe('up');
    expect(resizeKind(512, 512)).toBe('none');
  });

  it('still reports oversized images the way it always did', () => {
    expect(needsDownscale(4096, 4096)).toBe(true);
    expect(needsDownscale(512, 512)).toBe(false);
  });
});

describe('sizePresets', () => {
  it('every preset is something the engine will accept', () => {
    for (const preset of sizePresets) {
      expect(preset.width).toBeGreaterThanOrEqual(min);
      expect(preset.width).toBeLessThanOrEqual(max);
      expect(preset.height).toBeGreaterThanOrEqual(min);
      expect(preset.height).toBeLessThanOrEqual(max);
      expect(preset.width % 8).toBe(0);
      expect(preset.height % 8).toBe(0);
    }
  });
});

describe('limits', () => {
  // The point of this file is that it holds the NARROWER of the two nodes.
  it('never exceeds what the backend documents', () => {
    expect(limits.prompt.max).toBeLessThanOrEqual(limits.prompt.backendMax);
    expect(limits.negativePrompt.max).toBeLessThanOrEqual(limits.negativePrompt.backendMax);
  });

  it('defaults sit inside their own range', () => {
    expect(limits.steps.default).toBeGreaterThanOrEqual(limits.steps.min);
    expect(limits.steps.default).toBeLessThanOrEqual(limits.steps.max);
    expect(limits.cfgScale.default).toBeGreaterThanOrEqual(limits.cfgScale.min);
    expect(limits.cfgScale.default).toBeLessThanOrEqual(limits.cfgScale.max);
  });
});
