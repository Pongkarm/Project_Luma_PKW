import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';

type Props = {
  tone?: 'error' | 'info' | 'note';
  icon?: IconName;
  children: ReactNode;
};

export function Alert({ tone = 'info', icon, children }: Props) {
  const resolvedIcon: IconName = icon ?? (tone === 'error' ? 'alert' : 'info');
  return (
    <div
      className={['alert', tone === 'error' ? 'alert--error' : '', tone === 'note' ? 'alert--note' : '']
        .filter(Boolean)
        .join(' ')}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <Icon name={resolvedIcon} size={14} className="alert__icon" />
      <div>{children}</div>
    </div>
  );
}
