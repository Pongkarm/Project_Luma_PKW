import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskType } from '../../contracts/generation.ts';
import type { Language } from '../../config/i18n.ts';

export type ThemeName = 'dark' | 'light';

type PreferencesState = {
  theme: ThemeName;
  language: Language;
  lastMode: TaskType;
  advancedOpen: boolean;
  railCollapsed: boolean;
  avoidOpen: boolean;
  preferredModel: string | null;
  setTheme: (theme: ThemeName) => void;
  setLanguage: (language: Language) => void;
  toggleTheme: () => void;
  setLastMode: (mode: TaskType) => void;
  setAdvancedOpen: (open: boolean) => void;
  toggleRail: () => void;
  setAvoidOpen: (open: boolean) => void;
  setPreferredModel: (model: string) => void;
};

/** Start in Thai for a Thai browser, English otherwise. */
function systemLanguage(): Language {
  return navigator.language?.toLowerCase().startsWith('th') ? 'th' : 'en';
}

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
      language: systemLanguage(),
      lastMode: 'txt2img',
      advancedOpen: false,
      railCollapsed: false,
      avoidOpen: false,
      preferredModel: null,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setLastMode: (lastMode) => set({ lastMode }),
      setAdvancedOpen: (advancedOpen) => set({ advancedOpen }),
      toggleRail: () => set({ railCollapsed: !get().railCollapsed }),
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

/**
 * Sets <html lang>, which drives both assistive technology and the Thai
 * typography rules — Thai stacks vowels and tone marks, so it needs more
 * leading than Latin text does.
 */
export function applyLanguage(language: Language): void {
  document.documentElement.lang = language;
}
