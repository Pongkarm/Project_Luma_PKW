import { Slider } from '../../../shared/ui/Slider.tsx';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { limits, fitToEngine, needsDownscale } from '../../../config/limits.ts';
import { ImageInput } from '../upload/ImageInput.tsx';
import type { SourceImage } from '../draftStore.ts';
import type { TaskType } from '../../../contracts/generation.ts';
import { SizeControl } from './SizeControl.tsx';
import { useT } from '../../../shared/hooks/useT.ts';

type Props = {
  mode: TaskType;
  source: SourceImage | null;
  onSource: (source: SourceImage | null) => void;
  denoisingStrength: number;
  onDenoising: (value: number) => void;
  width: number;
  height: number;
  onSize: (size: { width: number; height: number }) => void;
  sizeOverride: boolean;
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
  sizeOverride,
}: Props) {
  const t = useT();

  if (mode === 'txt2img') {
    return <SizeControl width={width} height={height} onChange={onSize} />;
  }

  const isInpaint = mode === 'inpaint';
  const fitted = source ? fitToEngine(source.width, source.height) : null;
  const output = sizeOverride ? { width, height } : fitted;
  const scaled = source ? needsDownscale(source.width, source.height) : false;

  return (
    <>
      <ImageInput
        label={isInpaint ? t('upload.toPaintOn') : t('upload.starting')}
        value={source}
        onChange={onSource}
      />

      {source && output ? (
        <div className="field" style={{ gap: 4, marginTop: -4 }}>
          <div className="label">
            <span>{t('size.output')}</span>
            <span className="label__meta mono">
              {output.width} × {output.height} px
            </span>
          </div>
          {sizeOverride ? (
            <span className="field__hint">{t('size.byHandOn')}</span>
          ) : scaled ? (
            <span
              className="field__hint"
              style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}
            >
              <Icon name="info" size={12} />
              <span>
                {t('size.scaled', {
                  w: source.width,
                  h: source.height,
                  max: limits.dimension.max,
                })}
              </span>
            </span>
          ) : (
            <span className="field__hint">{t('size.matches')}</span>
          )}
        </div>
      ) : null}

      <Slider
        label={
          <>
            {t('size.changeAmount')}
            <span className="modedot" title={t('gen.modeDot')} />
          </>
        }
        value={denoisingStrength}
        min={limits.denoisingStrength.min}
        max={limits.denoisingStrength.max}
        step={limits.denoisingStrength.step}
        decimals={2}
        ends={
          isInpaint
            ? [t('size.blend'), t('size.replace')]
            : [t('size.keep'), t('size.reinvent')]
        }
        onChange={onDenoising}
      />
    </>
  );
}
