import { Button } from '../../shared/ui/Button.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import { useMediaQuery, CANVAS_CAPABLE_QUERY } from '../../shared/hooks/useMediaQuery.ts';
import { useSendToGenerate } from './studioActions.ts';
import type { StudioVersion } from './studioStore.ts';

type Props = {
  /** The cut-out's mask. */
  mask: Blob;
  maskUrl: string;
  /** The full picture the mask was cut from — what Inpaint will repaint. */
  source: StudioVersion;
  showMask: boolean;
  onShowMask: (show: boolean) => void;
};

/**
 * What a background removal adds to the panel: the mask itself, and the way
 * to Inpaint with it already painted — the background, or the subject instead.
 */
export function CutoutMask({ mask, maskUrl, source, showMask, onShowMask }: Props) {
  const t = useT();
  const send = useSendToGenerate();
  // The mask canvas is not offered on a phone, so neither is the hand-off to it.
  const canPaintMask = useMediaQuery(CANVAS_CAPABLE_QUERY);
  const disabled = !canPaintMask || send.busy !== null;
  const title = canPaintMask ? undefined : t('studio.maskNeedsRoom');

  return (
    <div className="field">
      <div className="label">
        <span className="eyebrow">{t('studio.mask')}</span>
        <button type="button" className="linklike" onClick={() => onShowMask(!showMask)}>
          {showMask ? t('studio.showCutout') : t('studio.showMask')}
        </button>
      </div>
      <img src={maskUrl} alt="" className="studio-mask-thumb" />

      {/* White in the mask is the subject, so replacing the background inverts it. */}
      <Button
        icon="layers"
        busy={send.busy === 'mask'}
        disabled={disabled}
        title={title}
        onClick={() => void send.asInpaint(source, mask, true)}
      >
        {t('studio.replaceBackground')}
      </Button>
      <Button variant="ghost" disabled={disabled} title={title} onClick={() => void send.asInpaint(source, mask, false)}>
        {t('studio.repaintSubject')}
      </Button>
      <span className="field__hint">{canPaintMask ? t('studio.maskHint') : t('studio.maskNeedsRoom')}</span>
    </div>
  );
}
