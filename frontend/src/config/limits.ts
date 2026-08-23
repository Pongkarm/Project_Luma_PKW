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

export const sizePresets = [
  { label: '512 × 512', hint: '1:1', width: 512, height: 512 },
  { label: '512 × 768', hint: '2:3', width: 512, height: 768 },
  { label: '768 × 512', hint: '3:2', width: 768, height: 512 },
] as const;
