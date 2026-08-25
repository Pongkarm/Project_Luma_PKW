import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The settings a preset carries. The prompt is deliberately not one of them. */
export type PresetValues = {
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  samplerName: string;
  modelName: string;
  loraId: string;
  negativePrompt: string;
};

export type Preset = PresetValues & { id: string; name: string };

type PresetState = {
  presets: Preset[];
  save: (name: string, values: PresetValues) => void;
  remove: (id: string) => void;
};

const MAX_PRESETS = 12;

/**
 * Saved generation settings, kept on the device.
 *
 * Nothing appears in the interface until someone saves their first preset, so
 * the default panel stays exactly as clean as it was.
 */
export const usePresets = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],
      save(name, values) {
        const trimmed = name.trim();
        if (!trimmed) return;
        const existing = get().presets.find((p) => p.name === trimmed);
        const preset: Preset = {
          ...values,
          id: existing?.id ?? crypto.randomUUID(),
          name: trimmed,
        };
        set({
          presets: existing
            ? get().presets.map((p) => (p.id === existing.id ? preset : p))
            : [preset, ...get().presets].slice(0, MAX_PRESETS),
        });
      },
      remove(id) {
        set({ presets: get().presets.filter((p) => p.id !== id) });
      },
    }),
    { name: 'luma.presets' },
  ),
);
