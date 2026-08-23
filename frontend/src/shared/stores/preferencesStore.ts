import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskType } from '../../contracts/generation.ts';

export type ThemeName = 'dark' | 'light';

type PreferencesState = {
  theme: ThemeName;
  lastMode: TaskType;
  advancedOpen: boolean;
  avoidOpen: boolean;
  preferredModel: string | null;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  setLastMode: (mode: TaskType) => void;
  setAdvancedOpen: (open: boolean) => void;
  setAvoidOpen: (open: boolean) => void;
  setPreferredModel: (model: string) => void;
};

function systemTheme(): ThemeName {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Small, personal, and none of the server's business — so it lives on the
 * device and nowhere else.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      theme: systemTheme(),
      lastMode: 'txt2img',
      advancedOpen: false,
      avoidOpen: false,
      preferredModel: null,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setLastMode: (lastMode) => set({ lastMode }),
      setAdvancedOpen: (advancedOpen) => set({ advancedOpen }),
      setAvoidOpen: (avoidOpen) => set({ avoidOpen }),
      setPreferredModel: (preferredModel) => set({ preferredModel }),
    }),
    { name: 'luma.preferences' },
  ),
);

/** Applies the theme to <html> so CSS tokens switch. Called once from the app root. */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}
