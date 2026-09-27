/**
 * Moving pictures between the studio and the rest of the app.
 *
 *   useOpenInStudio   a finished run  → the studio page
 *   useSendToGenerate a studio version → the Generate page (img2img or inpaint)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadService } from '../../services/uploadService.ts';
import { isApiError } from '../../contracts/errors.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { toSourceImage, useDraft } from '../generate/draftStore.ts';
import { useRun } from '../generate/run/runStore.ts';
import { useMaskHandoff } from '../generate/maskHandoff.ts';
import { useStudio, type StudioVersion } from './studioStore.ts';
import { openRunInStudio } from './studioImage.ts';

/** Open a finished run in the studio — from the quick-edit bar or from History. */
export function useOpenInStudio() {
  const navigate = useNavigate();
  const showToast = useToasts((state) => state.show);
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function openGeneration(id: string) {
    // Already open — perhaps edited from the result stage: carry on from there.
    if (useStudio.getState().originRunId === id) {
      navigate('/studio');
      return;
    }
    setBusy(true);
    try {
      await openRunInStudio(id);
      navigate('/studio');
    } catch (error) {
      showToast(isApiError(error) ? error.message : t('studio.openFailed'));
    } finally {
      setBusy(false);
    }
  }

  return { openGeneration, busy };
}

/**
 * Carry a studio version back to Generate: as the img2img source, or — for a
 * background removal — as an inpaint source with its mask already painted.
 *
 * Generation reads its source from /uploads, so the bytes are uploaded first,
 * exactly as "Start from this" does for a finished run.
 */
export function useSendToGenerate() {
  const navigate = useNavigate();
  const draft = useDraft();
  const setActiveRun = useRun((state) => state.setActiveRun);
  const sendMask = useMaskHandoff((state) => state.send);
  const showToast = useToasts((state) => state.show);
  const t = useT();
  const [busy, setBusy] = useState<'source' | 'mask' | null>(null);

  /** Generation reads its source from /uploads, so the version goes there first. */
  async function upload(version: StudioVersion) {
    const name = `studio-${version.tool ?? 'original'}-${version.id}.png`;
    const uploaded = await uploadService.uploadImage(version.blob, name);
    draft.setSource(toSourceImage(uploaded, name));
    // An open result would hide the source preview and the mask canvas.
    setActiveRun(null);
  }

  /** Start the next img2img run from this version. */
  async function asSource(version: StudioVersion) {
    setBusy('source');
    try {
      await upload(version);
      draft.setMode('img2img');
      showToast(t('studio.sentToGenerate'));
      navigate('/generate');
    } catch (error) {
      showToast(isApiError(error) ? error.message : t('studio.handoffFailed'));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Open Inpaint on `source` with `mask` already painted. `invert` repaints
   * what the mask left black — the background, for a cut-out.
   *
   * `source` is the image the mask was cut from, not the transparent cut-out:
   * inpainting needs the full picture to repaint part of it.
   */
  async function asInpaint(source: StudioVersion, mask: Blob, invert: boolean) {
    setBusy('mask');
    try {
      await upload(source);
      draft.setMode('inpaint');
      sendMask(mask, invert);
      navigate('/generate');
    } catch (error) {
      showToast(isApiError(error) ? error.message : t('studio.handoffFailed'));
    } finally {
      setBusy(null);
    }
  }

  return { asSource, asInpaint, busy };
}
