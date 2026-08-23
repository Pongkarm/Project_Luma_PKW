import type { GenerationStatus } from '../../contracts/generation.ts';
import type { IconName } from './Icon.tsx';

/**
 * The API's four words, translated for a person exactly once. Colour is never
 * the only signal: every status carries an icon and a label as well.
 */
export const statusPresentation: Record<
  GenerationStatus,
  { label: string; icon: IconName; dashed?: boolean }
> = {
  pending: { label: 'Queued', icon: 'queue', dashed: true },
  processing: { label: 'Processing', icon: 'refresh' },
  completed: { label: 'Completed', icon: 'checkCircle' },
  failed: { label: 'Failed', icon: 'xCircle' },
};

export function statusLabel(status: GenerationStatus): string {
  return statusPresentation[status].label;
}
