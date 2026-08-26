import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { limits, sizePresets, snapDimension } from '../../../config/limits.ts';
import { useT } from '../../../shared/hooks/useT.ts';
import type { TKey } from '../../../config/i18n.ts';

type Props = {
  label?: string;
  width: number;
  height: number;
  onChange: (size: { width: number; height: number }) => void;
  /** Where Reset returns to. Defaults to the first preset. */
  defaultSize?: { width: number; height: number };
};

/** A proportional rectangle, so the shape reads before the numbers do. */
function ShapeGlyph({ width, height, box = 14 }: { width: number; height: number; box?: number }) {
  const scale = box / Math.max(width, height);
  return (
    <span
      aria-hidden="true"
      style={{
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        border: '1.5px solid currentColor',
        borderRadius: 2,
        flex: 'none',
        opacity: 0.9,
      }}
    />
  );
}

/** "5:7" when it reduces cleanly, otherwise a decimal — never something like 95:96. */
function ratioLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const a = width / divisor;
  const b = height / divisor;
  if (a <= 20 && b <= 20) return `${a}:${b}`;
  return width >= height ? `${(width / height).toFixed(2)}:1` : `1:${(height / width).toFixed(2)}`;
}

type RowProps = {
  label: string;
  ariaLabel: string;
  value: number;
  onCommit: (value: number) => void;
};

/**
 * One dimension: a slider to explore with, and a field to type an exact value in.
 *
 * The field keeps its own text while it is being edited and only snaps on blur
 * or Enter — clamping on every keystroke made typing "640" impossible, because
 * the first character alone was already below the minimum.
 */
function DimensionRow({ label, ariaLabel, value, onCommit }: RowProps) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  function commitText() {
    setEditing(false);
    const parsed = Number(text);
    if (Number.isFinite(parsed) && text.trim() !== '') onCommit(snapDimension(parsed));
    else setText(String(value));
  }

  const { min, max, multipleOf } = limits.dimension;
  const fill = ((value - min) / (max - min)) * 100;

  return (
    <div className="field field--tight">
      <div className="label">
        <label htmlFor={id}>{label}</label>
        <input
          className="num"
          inputMode="numeric"
          aria-label={ariaLabel}
          value={text}
          onFocus={() => setEditing(true)}
          onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ''))}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={multipleOf}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(event) => onCommit(snapDimension(Number(event.target.value)))}
      />
    </div>
  );
}

/**
 * Size picker: three aspect-ratio presets plus a custom section that appears in
 * place rather than being buried under Advanced. Swapping the two dimensions is
 * always one click away, whichever mode you are in.
 */
export function SizeControl({ label, width, height, onChange, defaultSize }: Props) {
  const t = useT();
  const [locked, setLocked] = useState(false);
  const fallback = defaultSize ?? { width: sizePresets[0].width, height: sizePresets[0].height };
  const isDefault = width === fallback.width && height === fallback.height;

  /**
   * With the ratio locked, moving one dimension moves the other to match.
   * The ratio is taken from the values as they were when the lock went on, so
   * rounding to multiples of 8 cannot make it drift over repeated drags.
   */
  const ratio = useRef(width / height);

  function setLock(next: boolean) {
    if (next) ratio.current = width / height;
    setLocked(next);
  }

  /**
   * Hold the ratio while keeping both sides inside the engine's range. When the
   * partner dimension would fall outside it, the dimension being dragged backs
   * off instead — letting it run on would silently break the lock at the edges.
   */
  function withRatio(driver: number, drivingWidth: boolean) {
    const { min, max } = limits.dimension;
    const r = ratio.current;

    // Work in raw numbers and only snap at the very end: snapDimension clamps,
    // so checking the range after snapping would never see an out-of-range
    // partner and the lock would quietly break at the edges.
    let w = drivingWidth ? driver : driver * r;
    let h = drivingWidth ? driver / r : driver;

    if (h > max) {
      h = max;
      w = max * r;
    } else if (h < min) {
      h = min;
      w = min * r;
    }
    if (w > max) {
      w = max;
      h = max / r;
    } else if (w < min) {
      w = min;
      h = min / r;
    }

    return { width: snapDimension(w), height: snapDimension(h) };
  }

  function commitWidth(next: number) {
    onChange(locked ? withRatio(next, true) : { width: snapDimension(next), height });
  }

  function commitHeight(next: number) {
    onChange(locked ? withRatio(next, false) : { width, height: snapDimension(next) });
  }
  // Custom stays open once chosen, even when the numbers happen to match a
  // preset — clicking "Custom" should reveal the controls, not change the size.
  const [customOpen, setCustomOpen] = useState(false);
  const activePreset = sizePresets.find((p) => p.width === width && p.height === height);
  const isCustom = customOpen || !activePreset;

  return (
    <div className="field">
      <div className="label">
        <span>{label ?? t('size.label')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
          <span className="label__meta mono">
            {width} × {height} px · {ratioLabel(width, height)}
          </span>
          <button
            type="button"
            className="icobtn"
            style={{ width: 22, height: 22 }}
            aria-label={t('size.swap')}
            title={t('size.swap')}
            onClick={() => {
              ratio.current = height / width;
              onChange({ width: height, height: width });
            }}
          >
            <Icon name="swap" size={12} />
          </button>
          <button
            type="button"
            className="icobtn"
            style={{
              width: 22,
              height: 22,
              color: locked ? 'var(--accent-text)' : undefined,
              borderColor: locked ? 'var(--accent)' : undefined,
            }}
            aria-pressed={locked}
            aria-label={locked ? t('size.lockOn') : t('size.lock')}
            title={locked ? t('size.lockOn') : t('size.lock')}
            onClick={() => setLock(!locked)}
          >
            <Icon name={locked ? 'lock' : 'lockOpen'} size={12} />
          </button>
          <button
            type="button"
            className="icobtn"
            style={{ width: 22, height: 22 }}
            disabled={isDefault}
            aria-label={t('size.reset')}
            title={t('size.reset')}
            onClick={() => onChange(fallback)}
          >
            <Icon name="refresh" size={12} />
          </button>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
        {sizePresets.map((preset) => {
          const selected = !customOpen && preset === activePreset;
          return (
            <button
              key={preset.id}
              type="button"
              className={`btn btn--sm ${selected ? 'btn--secondary' : 'btn--ghost'}`}
              aria-pressed={selected}
              title={`${t(`size.${preset.id}` as TKey)} · ${preset.width} × ${preset.height}`}
              style={{ gap: 'var(--sp-6)', border: selected ? undefined : '1px solid var(--line)' }}
              onClick={() => {
                setCustomOpen(false);
                setLocked(false);
                onChange({ width: preset.width, height: preset.height });
              }}
            >
              <ShapeGlyph width={preset.width} height={preset.height} />
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          className={`btn btn--sm ${isCustom ? 'btn--secondary' : 'btn--ghost'}`}
          aria-pressed={isCustom}
          style={{ border: isCustom ? undefined : '1px solid var(--line)' }}
          onClick={() => setCustomOpen(true)}
        >
          {t('size.custom')}
        </button>
      </div>

      {isCustom ? (
        <div style={{ display: 'flex', gap: 'var(--sp-14)', alignItems: 'center', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
          <span
            style={{
              width: 56,
              height: 56,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-3)',
            }}
          >
            <ShapeGlyph width={width} height={height} box={52} />
          </span>
          <div style={{ flex: '1 1 190px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-10)' }}>
            <DimensionRow
              label={t('size.width')}
              ariaLabel={t('size.widthPx')}
              value={width}
              onCommit={commitWidth}
            />
            <DimensionRow
              label={t('size.height')}
              ariaLabel={t('size.heightPx')}
              value={height}
              onCommit={commitHeight}
            />
          </div>
        </div>
      ) : null}

      <span className="field__hint">
        {t('size.hint', {
          min: limits.dimension.min,
          max: limits.dimension.max,
          step: limits.dimension.multipleOf,
        })}
      </span>
    </div>
  );
}
