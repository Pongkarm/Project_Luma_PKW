/**
 * Parameter limits.
 *
 * The two nodes disagree, and the backend is the more permissive of the pair:
 * it will happily accept a job the AI node then rejects at inference time,
 * which reads to a user as a broken product. So the UI enforces the NARROWER
 * value and records where each one comes from.
 *
 *   backend  app/schemas/generation.py   (GenerationBase)
 *   ai node  ai_server/server.py         (GenerateRequest) + config.py (AIConfig)
 *
 * When the two are reconciled upstream, this file is the only thing to change.
 */
export const limits = {
  prompt: {
    /** backend: 1-2000 · ai node: 1-500 */
    max: 500,
    backendMax: 2000,
  },
  negativePrompt: {
    max: 500,
    backendMax: 2000,
  },
  steps: {
    /** backend: 1-150 · ai node: 1-50 */
    min: 1,
    max: 50,
    step: 1,
    default: 25,
  },
  cfgScale: {
    /** backend: 0.0-30.0 · ai node: 1.0-20.0 */
    min: 1,
    max: 20,
    step: 0.5,
    default: 7.5,
  },
  denoisingStrength: {
    /** backend: 0.0-1.0 · ai node: same */
    min: 0,
    max: 1,
    step: 0.05,
    defaultImg2Img: 0.65,
    defaultInpaint: 0.8,
  },
  dimension: {
    /** backend: 64-2048 · ai node: 256-768, and Forge wants multiples of 8 */
    min: 256,
    max: 768,
    multipleOf: 8,
  },
  upload: {
    /** backend: app/core/config.py MAX_UPLOAD_SIZE_BYTES */
    maxBytes: 10 * 1024 * 1024,
    /** backend: MAX_IMAGE_DIMENSION */
    maxPixels: 4096,
    /** backend: app/services/upload.py ALLOWED_MIME_TYPES */
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
    accept: 'image/png,image/jpeg,image/webp',
  },
} as const;

/**
 * Aspect-ratio presets. Each resolves to the largest size the engine accepts
 * for that shape — the checkpoints in use are XL-family models, which lose
 * quality below 768 on the long side.
 */
export const sizePresets = [
  { id: 'square', label: '1:1', name: 'Square', width: 768, height: 768 },
  { id: 'portrait', label: '2:3', name: 'Portrait', width: 512, height: 768 },
  { id: 'landscape', label: '3:2', name: 'Landscape', width: 768, height: 512 },
] as const;

/** Snap to the multiple of 8 Forge expects, then clamp into the engine's range. */
export function snapDimension(value: number): number {
  const { min, max, multipleOf } = limits.dimension;
  // Math.min/Math.max propagate NaN rather than clamping it, so an empty or
  // half-typed field would have travelled all the way to the request as NaN.
  if (!Number.isFinite(value)) return min;
  const snapped = Math.round(value / multipleOf) * multipleOf;
  return Math.min(max, Math.max(min, snapped));
}

/**
 * The size the engine will actually produce for a source image.
 *
 * Uploads are allowed up to 4096px but the AI node only accepts 256-768, so a
 * photo straight from a phone must be scaled down before it is asked for —
 * otherwise the job is rejected mid-flight and the person is told nothing useful.
 */
export function fitToEngine(width: number, height: number): { width: number; height: number } {
  const { min, max } = limits.dimension;
  const longest = Math.max(width, height);
  const scale = longest > max ? max / longest : 1;
  const w = snapDimension(width * scale);
  const h = snapDimension(height * scale);
  return { width: Math.max(min, w), height: Math.max(min, h) };
}

/** True when the engine cannot work at the source image's own size. */
export function needsDownscale(width: number, height: number): boolean {
  return Math.max(width, height) > limits.dimension.max;
}

/**
 * How fitToEngine will change a source image, if at all.
 *
 * needsDownscale alone answered only half the question. The engine's range has
 * a floor as well as a ceiling, so an image under 256px is resized too — and
 * because nothing reported that, the panel told the person their output
 * "matches your image" while quietly enlarging it.
 */
export function resizeKind(width: number, height: number): 'none' | 'down' | 'up' {
  if (needsDownscale(width, height)) return 'down';
  const fitted = fitToEngine(width, height);
  return fitted.width !== width || fitted.height !== height ? 'up' : 'none';
}
