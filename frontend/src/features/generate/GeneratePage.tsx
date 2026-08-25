import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../shared/ui/Icon.tsx';
import { IconButton } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { StatusChip } from '../../shared/ui/StatusChip.tsx';
import { uploadService } from '../../services/uploadService.ts';
import { generationService } from '../../services/generationService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import { isApiError } from '../../contracts/errors.ts';
import { useMediaQuery, CANVAS_CAPABLE_QUERY } from '../../shared/hooks/useMediaQuery.ts';
import { ControlsPanel } from './ControlsPanel.tsx';
import { MaskCanvas } from './canvas/MaskCanvas.tsx';
import { useMaskEditor } from './canvas/useMaskEditor.ts';
import { ResultStage } from './run/ResultStage.tsx';
import { RunStrip } from './run/RunStrip.tsx';
import { useGenerationJob } from './run/useGenerationJob.ts';
import { useRun } from './run/runStore.ts';
import { toSourceImage, useDraft } from './draftStore.ts';
import { useT } from '../../shared/hooks/useT.ts';
import type { TKey } from '../../config/i18n.ts';

const modeTitleKeys: Record<string, TKey> = {
  txt2img: 'stage.textToImage',
  img2img: 'stage.imageToImage',
  inpaint: 'stage.inpaint',
};

export function GeneratePage() {
  const draft = useDraft();
  const t = useT();
  const queryClient = useQueryClient();
  const { activeRunId, startedAt, setActiveRun } = useRun();
  const { job, stalled, refetch } = useGenerationJob(activeRunId, startedAt);
  const canPaintMask = useMediaQuery(CANVAS_CAPABLE_QUERY);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reusing, setReusing] = useState(false);
  const [measured, setMeasured] = useState<{ url: string; width: number; height: number } | null>(null);

  const source = draft.source;

  // The upload response already carries the dimensions, so the canvas can be
  // sized before the image paints; the <img>'s own measurement supersedes it
  // once it loads. Derived rather than synced, so changing the source image
  // cannot leave a stale size behind.
  const naturalSize =
    measured && source && measured.url === source.url
      ? { width: measured.width, height: measured.height }
      : source
        ? { width: source.width, height: source.height }
        : { width: 0, height: 0 };

  const editor = useMaskEditor(naturalSize.width, naturalSize.height);

  // A phone cannot paint a mask usefully; fall back rather than offer a canvas
  // nobody can be accurate on.
  useEffect(() => {
    if (!canPaintMask && draft.mode === 'inpaint') draft.setMode('img2img');
  }, [canPaintMask, draft]);

  const submit = useMutation({
    async mutationFn() {
      let maskUrl: string | null = null;

      if (draft.mode === 'inpaint') {
        const maskBlob = await editor.exportMask();
        if (!maskBlob) throw new Error('NO_MASK');
        // The mask goes through the very same upload endpoint as any image.
        const uploaded = await uploadService.uploadImage(maskBlob, 'mask.png');
        maskUrl = uploaded.url;
      }

      return generationService.create(draft.toRequest(maskUrl));
    },
    onSuccess(created) {
      setSubmitError(null);
      setActiveRun(created.id);
      queryClient.setQueryData(queryKeys.generation(created.id), created);
      void queryClient.invalidateQueries({ queryKey: queryKeys.generationsAll });
    },
    onError(error) {
      if (error instanceof Error && error.message === 'NO_MASK') {
        setSubmitError(t('error.noMask'));
        return;
      }
      setSubmitError(isApiError(error) ? error.message : t('error.startRun'));
    },
  });

  // ⌘↵ / Ctrl+↵ from anywhere, including inside the prompt box.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!submit.isPending) submit.mutate();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submit]);

  /** Re-upload a finished image so the next run can start from it. */
  async function startFromResult() {
    if (!job || job.status !== 'completed') return;
    setReusing(true);
    setSubmitError(null);
    try {
      const blob = await generationService.fetchImageBlob(job.id);
      const uploaded = await uploadService.uploadImage(blob, `luma-${job.id}.png`);
      draft.setSource(toSourceImage(uploaded, `Result ${job.id.slice(0, 8)}`));
      draft.setMode('img2img');
      setActiveRun(null);
    } catch (error) {
      setSubmitError(isApiError(error) ? error.message : t('error.reuseImage'));
    } finally {
      setReusing(false);
    }
  }

  const showMaskCanvas =
    !job && draft.mode === 'inpaint' && Boolean(source) && canPaintMask;

  const submitHint = useMemo(() => {
    if (draft.mode === 'txt2img') return `${draft.width} × ${draft.height} · ${draft.steps} steps`;
    if (!source) return t('gen.addImage');
    return `${source.width} × ${source.height} · change ${draft.denoisingStrength.toFixed(2)}`;
  }, [draft.mode, draft.width, draft.height, draft.steps, draft.denoisingStrength, source, t]);

  return (
    <div className="app__workspace">
      <main className="main">
        {showMaskCanvas ? (
          <MaskCanvas
            editor={editor}
            sourceUrl={uploadService.publicUrl(source!.url)}
            onNaturalSize={(size) => setMeasured({ url: source!.url, ...size })}
          />
        ) : (
          <>
            <div className="stagebar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t(modeTitleKeys[draft.mode])}</span>
                {job ? (
                  <StatusChip status={job.status} />
                ) : (
                  <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
                    {source ? t('stage.sourceReady') : t('stage.noRun')}
                  </span>
                )}
              </div>
              {job ? (
                <IconButton icon="close" label={t('stage.close')} onClick={() => setActiveRun(null)} />
              ) : null}
            </div>

            <div className="stage">
              {job ? (
                <ResultStage
                  job={job}
                  stalled={stalled}
                  startedAt={startedAt}
                  onRetry={() => submit.mutate()}
                  onCheckAgain={refetch}
                  onUseAsSource={() => void startFromResult()}
                  useAsSourceBusy={reusing}
                />
              ) : source ? (
                <SourcePreview
                  url={uploadService.publicUrl(source.url)}
                  caption={`${source.width} × ${source.height}`}
                />
              ) : (
                <EmptyStage />
              )}
            </div>
          </>
        )}

        {submitError ? (
          <div style={{ padding: '0 16px 12px' }}>
            <Alert tone="error">{submitError}</Alert>
          </div>
        ) : null}

        <RunStrip activeRunId={activeRunId} onSelect={setActiveRun} />
      </main>

      <ControlsPanel
        canPaintMask={canPaintMask}
        submitting={submit.isPending}
        submitLabel={draft.mode === 'inpaint' ? t('gen.repaint') : t('gen.generate')}
        submitHint={submitHint}
        blockedReason={
          draft.mode === 'inpaint' && !editor.hasMask && source ? t('gen.paintFirst') : null
        }
        onSubmit={() => submit.mutate()}
      />
    </div>
  );
}

function EmptyStage() {
  const t = useT();
  return (
    <div className="centered-note">
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--r-lg)',
          border: '1px dashed var(--line-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-3)',
        }}
      >
        <Icon name="image" size={22} />
      </div>
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('stage.empty')}</h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
        {t('stage.emptyBody')}
      </p>
      <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
        ⌘ + ↵
      </span>
    </div>
  );
}

function SourcePreview({ url, caption }: { url: string; caption: string }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <img
        src={url}
        alt={t('stage.startFrom')}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '58vh',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--line)',
        }}
      />
      <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
        {t('stage.source')} · {caption}
      </span>
    </div>
  );
}
