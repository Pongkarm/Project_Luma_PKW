import { Slider } from '../../../shared/ui/Slider.tsx';
import { limits, sizePresets } from '../../../config/limits.ts';
import { ImageInput } from '../upload/ImageInput.tsx';
import type { SourceImage } from '../draftStore.ts';
import type { TaskType } from '../../../contracts/generation.ts';

type Props = {
  mode: TaskType;
  source: SourceImage | null;
  onSource: (source: SourceImage | null) => void;
  denoisingStrength: number;
  onDenoising: (value: number) => void;
  width: number;
  height: number;
  onSize: (size: { width: number; height: number }) => void;
};

/**
 * Only the fields that differ between modes live here. Everything else — the
 * prompt, the model, the advanced block — is shared, so switching mode changes
 * three controls rather than the whole panel.
 */
export function ModeFields({
  mode,
  source,
  onSource,
  denoisingStrength,
  onDenoising,
  width,
  height,
  onSize,
}: Props) {
  if (mode === 'txt2img') {
    return (
      <div className="field">
        <span className="label">Size</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sizePresets.map((preset) => {
            const selected = preset.width === width && preset.height === height;
            return (
              <button
                key={preset.label}
                type="button"
                className={`btn btn--sm ${selected ? 'btn--secondary' : 'btn--ghost'}`}
                aria-pressed={selected}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  border: selected ? undefined : '1px solid var(--line)',
                }}
                onClick={() => onSize({ width: preset.width, height: preset.height })}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <span className="field__hint">
          The engine works between {limits.dimension.min} and {limits.dimension.max} pixels a side.
        </span>
      </div>
    );
  }

  const isInpaint = mode === 'inpaint';

  return (
    <>
      <ImageInput
        label={isInpaint ? 'Image to paint on' : 'Starting image'}
        value={source}
        onChange={onSource}
      />
      <Slider
        label={
          <>
            Change amount
            <span
              className="modedot"
              title="Reaches the engine in direct mode only — see the README"
            />
          </>
        }
        value={denoisingStrength}
        min={limits.denoisingStrength.min}
        max={limits.denoisingStrength.max}
        step={limits.denoisingStrength.step}
        decimals={2}
        ends={isInpaint ? ["Blend with what's there", 'Replace it'] : ['Keep the original', 'Reinvent it']}
        onChange={onDenoising}
      />
      {source ? (
        <span className="field__hint" style={{ marginTop: -8 }}>
          The result comes back at the source image's size, {source.width} × {source.height}.
        </span>
      ) : null}
    </>
  );
}
