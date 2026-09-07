export const TASK_TYPES = ['txt2img', 'img2img', 'inpaint'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const GENERATION_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const TERMINAL_STATUSES: readonly GenerationStatus[] = ['completed', 'failed'];

export function isTerminal(status: GenerationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Cancelling does not get its own status.
 *
 * POST /generations/{id}/cancel marks the row `failed` and writes this exact
 * string into error_message, so it is the only thing that tells a cancellation
 * apart from a run the engine could not finish. If the backend ever gains a
 * real `cancelled` status, this is the one place that has to change.
 */
export const CANCELLED_MESSAGE = 'Cancelled by user';

export function wasCancelled(run: {
  status: GenerationStatus;
  error_message: string | null;
}): boolean {
  return run.status === 'failed' && run.error_message === CANCELLED_MESSAGE;
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

/**
 * GET /generations/{id}/progress — the backend proxying the AI node.
 *
 * Mirrors app/schemas/generation.py :: GenerationProgressResponse. Every field
 * is optional on the wire, so every field is optional here.
 */
export type GenerationProgress = {
  task_id: string;
  status: GenerationStatus | string;
  /**
   * Whether the numbers below were observed or are simply absent.
   *
   * False when the backend could not reach the AI node, or is running in direct
   * mode where there is no queue to ask. It answers 200 either way; this is the
   * field that says which happened, and every metric is null when it is false.
   */
  live: boolean;
  /** 1-based place in the AI node's queue; 0 once the job is running. */
  queue_position: number | null;
  total_queued: number | null;
  /** 0.0–1.0. */
  progress: number | null;
  step: number | null;
  total_steps: number | null;
  elapsed: number | null;
  seed: number | null;
  error: string | null;
  message?: string | null;
};

/**
 * Whether there is a measurement to draw.
 *
 * The backend used to fill this response in from the database when the AI node
 * could not be reached — a flat 0.5 for anything processing — with nothing
 * marking it as a placeholder. It now sets `live: false` and nulls every metric
 * instead, so this is a plain read rather than the inference it used to be.
 */
export function hasRealProgress(p: GenerationProgress | null | undefined): boolean {
  return Boolean(p?.live) && p?.progress != null;
}

/**
 * How many jobs are ahead of this one, or null when that is not worth saying.
 *
 * A queue of one holding this job is true and tells nobody anything, so a
 * position is only reported once something is genuinely waiting behind it.
 */
export function queueAhead(p: GenerationProgress | null | undefined): number | null {
  if (!p?.live) return null;
  const total = p.total_queued ?? 0;
  const position = p.queue_position ?? 0;
  if (total <= 1 || position <= 0) return null;
  return position;
}
