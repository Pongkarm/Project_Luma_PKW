import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

type Props = {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
};

/** Progressive disclosure: the summary keeps the hidden values visible as text. */
export function Disclosure({ open, onToggle, label, summary, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: open ? 14 : 0 }}>
      <button type="button" className="disclosure" aria-expanded={open} onClick={onToggle}>
        <span className="disclosure__label">
          <Icon name="chevronDown" size={14} className="disclosure__chevron" />
          {label}
        </span>
        {summary && !open ? <span className="label__meta mono">{summary}</span> : null}
      </button>
      {open ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div> : null}
    </div>
  );
}
