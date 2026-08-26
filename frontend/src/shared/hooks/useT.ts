import { useCallback } from 'react';
import { translate, type TKey } from '../../config/i18n.ts';
import { usePreferences } from '../stores/preferencesStore.ts';

/** Translate a key in the language the person has chosen. */
export function useT() {
  const language = usePreferences((state) => state.language);
  return useCallback(
    (key: TKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );
}

/**
 * The chosen language itself, for the few things Intl formats rather than the
 * dictionary — dates and durations. Kept beside useT so a component that needs
 * both reaches for one module.
 */
export function useLanguage() {
  return usePreferences((state) => state.language);
}
