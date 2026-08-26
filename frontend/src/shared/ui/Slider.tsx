import { useId } from 'react';
import type { ReactNode } from 'react';

type Props = {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Words at each end — plainer than the number for someone who is guessing. */
  ends?: [string, string];
  /** Show an editable numeric field beside the label. */
  showNumber?: boolean;
  decimals?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

/**
 * A native range input, so keyboard support, the value announcement and the
 * platform's own accessibility all come for free. The paired number field edits
 * the same value rather than being a second control.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  ends,
  showNumber = true,
  decimals = 0,
  disabled,
  onChange,
}: Props) {
  const id = useId();
  const ratio = max === min ? 0 : ((value - min) / (max - min)) * 100;

  function commit(raw: string) {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(Math.min(max, Math.max(min, parsed)));
  }

  return (
    <div className="field">
      <div className="label">
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
          {label}
        </label>
        {showNumber ? (
          <input
            className="num"
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={typeof label === 'string' ? `${label} value` : 'Value'}
            onChange={(event) => commit(event.target.value)}
          />
        ) : (
          <span className="label__meta mono">{value.toFixed(decimals)}</span>
        )}
      </div>
      <input
        id={id}
        className="slider"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{ ['--fill' as string]: `${ratio}%` }}
        onChange={(event) => commit(event.target.value)}
      />
      {ends ? (
        <div className="slider-ends">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      ) : null}
    </div>
  );
}
