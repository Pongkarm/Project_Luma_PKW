import type { Language } from '../../config/i18n.ts';

/**
 * Durations and dates carry language too. Both used to be English-only: a
 * Thai interface reported "1m 30s" and, worse, handed the date to
 * Intl with an undefined locale, which is the *browser's* language rather than
 * the one the person picked — so switching the app to Thai left the dates in
 * whatever the browser happened to be set to.
 */
export function formatDuration(
  seconds: number | null | undefined,
  language: Language = 'en',
): string {
  if (seconds === null || seconds === undefined) return '—';
  const u = UNITS[language];
  if (seconds < 60) return `${seconds.toFixed(2)}${u.sec}`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}${u.min} ${rest}${u.sec}`;
}

const UNITS: Record<Language, { sec: string; min: string }> = {
  en: { sec: 's', min: 'm' },
  th: { sec: ' วิ', min: ' นาที' },
};

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(iso: string, language: Language = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(LOCALES[language], {
    year: 'numeric',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/*
 * Thai keeps the Gregorian year. th-TH on its own would render the Buddhist
 * era — correct for an official document, surprising in a tool that shows no
 * era anywhere else and would then disagree with the timestamps the backend
 * logs.
 */
const LOCALES: Record<Language, string> = {
  en: 'en-GB',
  th: 'th-TH-u-ca-gregory',
};


export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
