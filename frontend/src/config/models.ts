/**
 * Checkpoints and LoRA adapters.
 *
 * The AI node exposes GET /ai/models, but the browser must not reach Node 3
 * directly and the backend does not proxy it. Until it does, this list mirrors
 * ai_server/data/lora_registry.json and the checkpoints recorded in HANDOFF.md.
 *
 * Class C: replace this file with a systemService call the day the backend
 * exposes a models endpoint. Nothing else needs to change.
 */
export type ModelOption = {
  id: string;
  name: string;
  description: string;
};

export const checkpoints: ModelOption[] = [
  {
    id: 'counterfeitV30_v30.safetensors',
    name: 'Counterfeit v3.0',
    description: 'Illustration and anime',
  },
  {
    id: 'novaAnimeXL_ilV190.safetensors',
    name: 'Nova Anime XL',
    description: 'Detailed anime, XL base',
  },
  {
    id: 'prefectPonyXL_v6.safetensors',
    name: 'Prefect Pony XL',
    description: 'Stylised characters',
  },
];

export const defaultCheckpoint = checkpoints[0].id;

/**
 * The AI node injects trigger words itself from its registry, so the UI sends
 * an identifier and nothing else. Note that ai_server/server.py's
 * extract_primary_lora() honours only the FIRST entry — so this is a single
 * choice, not a multi-select, until that changes.
 */
export const loraOptions: ModelOption[] = [
  { id: '', name: 'None', description: 'No style adapter' },
  {
    id: 'SousouNoFrieren_Frieren_IlluXL.safetensors',
    name: 'Frieren',
    description: 'Character · Sousou no Frieren',
  },
  {
    id: 'himmel_sousou_no_frieren_ilxl.safetensors',
    name: 'Himmel',
    description: 'Character · the hero',
  },
  {
    id: 'niji_and_midj_mix217.safetensors',
    name: 'Niji & Midjourney mix',
    description: 'Vivid illustration aesthetic',
  },
  { id: 'tachi-e.safetensors', name: 'Tachi-e', description: 'Standing pose, clean lines' },
  {
    id: '[Artstyle] SomethingWeird_Geekpower [PDXL].safetensors',
    name: 'Geekpower',
    description: 'Retro pop art style',
  },
];

/** Sampler names Forge accepts. Not exposed by any API — see the note above. */
export const samplers = [
  'Euler a',
  'Euler',
  'DPM++ 2M Karras',
  'DPM++ SDE Karras',
  'DDIM',
  'UniPC',
] as const;
