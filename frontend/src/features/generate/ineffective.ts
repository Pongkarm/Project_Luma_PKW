import type { TaskType } from '../../contracts/generation.ts';
import { useEngineStatus } from '../../shared/hooks/useEngineStatus.ts';

/** A control the panel offers that the backend may or may not act on. */
export type Adjustable =
  | 'seed'
  | 'samplerName'
  | 'loraId'
  | 'negativePrompt'
  | 'model'
  | 'size'
  | 'denoisingStrength';

/**
 * Which controls the backend will ignore, given the mode it is running in.
 *
 * This mirrors `process_generation` in app/services/generation.py, which builds
 * a *different* payload per AI_MODE rather than forwarding the record. The
 * direct branch passes every stored field through; the callback branch names
 * its fields one by one, and whatever it does not name never reaches the AI
 * node — silently, with the run still reported as successful.
 *
 * Callback's two payloads differ from each other as well, so this is keyed on
 * task type: the img2img/inpaint branch drops the negative prompt, the
 * checkpoint and the output size on top of what txt2img already loses.
 *
 * Anything not confirmed is treated as effective. An unreachable backend, or
 * one that does not report its mode, must not make the panel claim controls are
 * dead when they may well work.
 */
export function ineffectiveIn(aiMode: string | null, task: TaskType): ReadonlySet<Adjustable> {
  if (aiMode?.toLowerCase() !== 'callback') return EMPTY;
  return task === 'txt2img' ? CALLBACK_TXT2IMG : CALLBACK_EDIT;
}

/*
 * These three sets are shared, not rebuilt per call: they are read during
 * render, and handing back a fresh Set each time would allocate on every
 * keystroke for no gain. ReadonlySet is what keeps that safe — a caller that
 * casts the type away and mutates one of these poisons it for every other
 * caller, so don't.
 */
const EMPTY: ReadonlySet<Adjustable> = new Set();

// callback_payload for /ai/generate carries prompt, negative_prompt, model,
// steps, cfg_scale, width, height — and nothing else.
const CALLBACK_TXT2IMG: ReadonlySet<Adjustable> = new Set<Adjustable>([
  'seed',
  'samplerName',
  'loraId',
]);

// callback_payload for /ai/edit carries prompt, image, mask, mode, steps and
// cfg_scale. The size it works at comes from the source image, not the panel.
const CALLBACK_EDIT: ReadonlySet<Adjustable> = new Set<Adjustable>([
  'seed',
  'samplerName',
  'loraId',
  'negativePrompt',
  'model',
  'size',
  'denoisingStrength',
]);

/** The same, resolved against whatever the backend is reporting right now. */
export function useIneffective(task: TaskType): ReadonlySet<Adjustable> {
  const { data } = useEngineStatus();
  if (!data || data.state !== 'online') return EMPTY;
  return ineffectiveIn(data.aiMode, task);
}
