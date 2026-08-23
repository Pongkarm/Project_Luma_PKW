import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  block?: boolean;
  busy?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  busy,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? (
        <Icon name="refresh" size={size === 'lg' ? 15 : 14} className="spin" />
      ) : icon ? (
        <Icon name={icon} size={size === 'lg' ? 15 : 14} />
      ) : null}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  large?: boolean;
  iconSize?: number;
};

export function IconButton({ icon, label, large, iconSize, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={['icobtn', large ? 'icobtn--lg' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? (large ? 16 : 14)} />
    </button>
  );
}
