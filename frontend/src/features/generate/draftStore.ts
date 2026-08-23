import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GenerationRequest, TaskType } from '../../contracts/generation.ts';
import type { ImageUploadResponse } from '../../contracts/upload.ts';
import { limits } from '../../config/limits.ts';
import { defaultCheckpoint } from '../../config/models.ts';

export type SourceImage = {
  /** The `url` the upload endpoint returned — what a generation refers to. */
  url: string;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
};

export function toSourceImage(response: ImageUploadResponse, originalName: string): SourceImage {
  return {
    url: response.url,
    filename: originalName,
    width: response.width,
    height: response.height,
    sizeBytes: response.size_bytes,
  };
}

type DraftState = {
  mode: TaskType;
  prompt: string;
  negativePrompt: string;
  modelName: string;
  /** One adapter only: the AI node reads just the first entry it is given. */
  loraId: string;
  samplerName: string;
  steps: number;
  cfgScale: number;
  /** Kept as text so "empty" can mean random without pretending to be a number. */
  seed: string;
  width: number;
  height: number;
  denoisingStrength: number;
  source: SourceImage | null;

  setMode: (mode: TaskType) => void;
  patch: (values: Partial<Omit<DraftState, 'patch' | 'setMode' | 'reset' | 'setSource' | 'toRequest'>>) => void;
  setSource: (source: SourceImage | null) => void;
  reset: () => void;
  toRequest: (maskUrl?: string | null) => GenerationRequest;
};

const initial = {
  mode: 'txt2img' as TaskType,
  prompt: '',
  negativePrompt: '',
  modelName: defaultCheckpoint,
  loraId: '',
  samplerName: 'Euler a',
  steps: limits.steps.default,
  cfgScale: limits.cfgScale.default,
  seed: '',
  width: 512,
  height: 512,
  denoisingStrength: limits.denoisingStrength.defaultImg2Img,
  source: null as SourceImage | null,
};

/**
 * What someone has typed but not yet submitted.
 *
 * Persisted deliberately: losing a prompt to an expired token or a failed run is
 * the worst small failure this product can have, so a draft survives a reload,
 * a 401 and a failed job.
 */
export const useDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      ...initial,

      setMode(mode) {
        set({
          mode,
          denoisingStrength:
            mode === 'inpaint'
              ? limits.denoisingStrength.defaultInpaint
              : limits.denoisingStrength.defaultImg2Img,
        });
      },

      patch(values) {
        set(values as Partial<DraftState>);
      },

      setSource(source) {
        set({ source });
      },

      reset() {
        set({ ...initial });
      },

      toRequest(maskUrl) {
        const draft = get();
        const seed = draft.seed.trim();
        const parsedSeed = seed === '' ? null : Number(seed);

        const request: GenerationRequest = {
          task_type: draft.mode,
          prompt: draft.prompt.trim(),
          negative_prompt: draft.negativePrompt.trim() || null,
          model_name: draft.modelName,
          sampler_name: draft.samplerName,
          steps: draft.steps,
          cfg_scale: draft.cfgScale,
          seed: parsedSeed !== null && Number.isFinite(parsedSeed) ? parsedSeed : null,
          width: draft.width,
          height: draft.height,
          // The backend types lora_config as a JSON object, not an array. The AI
          // node's extract_primary_lora() reads the "id" key first, so this is
          // the shape both ends agree on.
          lora_config: draft.loraId ? { id: draft.loraId } : null,
        };

        if (draft.mode === 'txt2img') return request;

        return {
          ...request,
          source_image_path: draft.source?.url ?? null,
          mask_image_path: draft.mode === 'inpaint' ? maskUrl ?? null : null,
          denoising_strength: draft.denoisingStrength,
          // For img2img and inpaint the engine works at the source image's size.
          width: draft.source?.width ?? draft.width,
          height: draft.source?.height ?? draft.height,
        };
      },
    }),
    {
      name: 'luma.draft',
      partialize: (state) => ({
        mode: state.mode,
        prompt: state.prompt,
        negativePrompt: state.negativePrompt,
        modelName: state.modelName,
        loraId: state.loraId,
        samplerName: state.samplerName,
        steps: state.steps,
        cfgScale: state.cfgScale,
        seed: state.seed,
        width: state.width,
        height: state.height,
        denoisingStrength: state.denoisingStrength,
        source: state.source,
      }),
    },
  ),
);

/** Why the Generate button is unavailable, or null when it is ready. */
export function draftBlocker(state: DraftState): string | null {
  if (state.prompt.trim().length === 0) return 'Describe the image first';
  if (state.prompt.trim().length > limits.prompt.max) return 'The prompt is too long';
  if (state.mode !== 'txt2img' && !state.source) return 'Add a starting image';
  return null;
}
