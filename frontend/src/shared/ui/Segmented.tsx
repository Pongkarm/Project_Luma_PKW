import { Icon, type IconName } from './Icon.tsx';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  /** Explains a disabled option instead of leaving it mute. */
  title?: string;
};

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  iconsOnly?: boolean;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  iconsOnly,
}: Props<T>) {
  return (
    <div
      className={['seg', iconsOnly ? 'seg--icons' : ''].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className="seg__item"
          aria-selected={option.value === value}
          aria-label={iconsOnly ? option.label : undefined}
          title={option.title ?? (iconsOnly ? option.label : undefined)}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={14} /> : null}
          {iconsOnly ? null : option.label}
        </button>
      ))}
    </div>
  );
}
