import type { GenerationStatus } from '../../contracts/generation.ts';
import { Icon } from './Icon.tsx';
import { statusPresentation } from './statusPresentation.ts';

export function StatusChip({ status, size = 12 }: { status: GenerationStatus; size?: number }) {
  const { label, icon, dashed } = statusPresentation[status];
  return (
    <span className={`status status--${status}`}>
      <Icon
        name={icon}
        size={size}
        strokeDasharray={dashed ? '3 3' : undefined}
        className={status === 'processing' ? 'spin' : undefined}
      />
      {label}
    </span>
  );
}
