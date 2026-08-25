import type { GenerationStatus } from '../../contracts/generation.ts';
import type { TKey } from '../../config/i18n.ts';
import type { IconName } from './Icon.tsx';

/**
 * The API's four words, mapped once to a label key and an icon. Colour is never
 * the only signal: every status carries an icon and a word as well.
 */
export const statusPresentation: Record<
  GenerationStatus,
  { labelKey: TKey; icon: IconName; dashed?: boolean }
> = {
  pending: { labelKey: 'run.queued', icon: 'queue', dashed: true },
  processing: { labelKey: 'run.processing', icon: 'refresh' },
  completed: { labelKey: 'run.completed', icon: 'checkCircle' },
  failed: { labelKey: 'run.failed', icon: 'xCircle' },
};
