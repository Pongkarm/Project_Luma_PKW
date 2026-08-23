export const TASK_TYPES = ['txt2img', 'img2img', 'inpaint'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const GENERATION_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const TERMINAL_STATUSES: readonly GenerationStatus[] = ['completed', 'failed'];

export function isTerminal(status: GenerationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * POST /generations — request body.
 * Mirrors app/schemas/generation.py :: GenerationBase. Every field the backend
 * accepts is here; nothing the backend does not accept is.
 */
export type GenerationRequest = {
  task_type: TaskType;
  prompt: string;
  negative_prompt?: string | null;
  model_name?: string;
  /**
   * The backend types this as a JSON object (Dict[str, Any]) — a JSON array is
   * rejected with 422, despite what HANDOFF.md shows. The AI node reads only the
   * first adapter, so the UI sends exactly one.
   */
  lora_config?: Record<string, unknown> | null;
  sampler_name?: string;
  steps?: number;
  cfg_scale?: number;
  /** Omit or null for a random seed. */
  seed?: number | null;
  width?: number;
  height?: number;
  /** The `url` returned by POST /uploads. Required for img2img and inpaint. */
  source_image_path?: string | null;
  /** The `url` of the uploaded mask. Used by inpaint. */
  mask_image_path?: string | null;
  denoising_strength?: number | null;
};

/** GET /generations/{id} and POST /generations — response. */
export type Generation = Required<
  Pick<GenerationRequest, 'task_type' | 'prompt' | 'model_name' | 'sampler_name' | 'steps' | 'cfg_scale' | 'width' | 'height'>
> & {
  id: string;
  user_id: string;
  status: GenerationStatus;
  negative_prompt: string | null;
  lora_config: Record<string, unknown> | null;
  seed: number | null;
  source_image_path: string | null;
  mask_image_path: string | null;
  denoising_strength: number | null;
  error_message: string | null;
  duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
  /** Computed server-side; non-null only once `status` is "completed". */
  image_url: string | null;
};

/** GET /generations — paginated response. */
export type GenerationList = {
  items: Generation[];
  total: number;
  page: number;
  page_size: number;
};

export type GenerationListParams = {
  page?: number;
  /** 1-100; the API rejects anything larger. */
  page_size?: number;
};
