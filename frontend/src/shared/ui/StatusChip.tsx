import type { GenerationStatus } from '../../contracts/generation.ts';
import { Icon } from './Icon.tsx';
import { statusPresentation } from './statusPresentation.ts';
import { useT } from '../hooks/useT.ts';

export function StatusChip({ status, size = 12 }: { status: GenerationStatus; size?: number }) {
  const { labelKey, icon, dashed } = statusPresentation[status];
  const t = useT();
  return (
    <span className={`status status--${status}`}>
      <Icon
        name={icon}
        size={size}
        strokeDasharray={dashed ? '3 3' : undefined}
        className={status === 'processing' ? 'spin' : undefined}
      />
      {t(labelKey)}
    </span>
  );
}
