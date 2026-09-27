import { Button } from '../../../shared/ui/Button.tsx';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { Alert } from '../../../shared/ui/Alert.tsx';
import { useAuthedImage } from '../../../shared/hooks/useAuthedImage.ts';
import { useElapsed } from '../../../shared/hooks/useElapsed.ts';
import { formatDuration, formatElapsed } from '../../../shared/utils/format.ts';
import { wasCancelled, type Generation } from '../../../contracts/generation.ts';
import { useT, useLanguage } from '../../../shared/hooks/useT.ts';
import { useToasts } from '../../../shared/ui/Toast.tsx';
import { useState } from 'react';
import { useDeleteRun } from './useDeleteRun.ts';
import { useCancelRun } from './useCancelRun.ts';
import { useGenerationProgress } from './useGenerationProgress.ts';
import { DeleteRunDialog } from './DeleteRunDialog.tsx';
import { ImageViewer } from '../../../shared/ui/ImageViewer.tsx';
import { useSendToGenerate } from '../../studio/studioActions.ts';
import { useQuickEdit } from '../../studio/useQuickEdit.ts';
import { QuickEditBar } from '../../studio/QuickEditBar.tsx';
import { ToolBusy } from '../../studio/ToolBusy.tsx';
import { toolMeta } from '../../studio/toolMeta.ts';

type Props = {
  job: Generation;
  stalled: boolean;
  startedAt: number | null;
  onRetry: () => void;
  onCheckAgain: () => void;
  onUseAsSource: () => void;
  useAsSourceBusy: boolean;
  onDeleted: () => void;
};

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="centered-note">{children}</div>;
}

export function ResultStage({
  job,
  stalled,
  startedAt,
  onRetry,
  onCheckAgain,
  onUseAsSource,
  useAsSourceBusy,
  onDeleted,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState(false);
  const remove = useDeleteRun(() => {
    setConfirming(false);
    onDeleted();
  });
  const cancel = useCancelRun();
  const t = useT();
  const language = useLanguage();
  const showToast = useToasts((state) => state.show);
  const running = job.status === 'pending' || job.status === 'processing';
  const elapsed = useElapsed(startedAt, running && !stalled);
  const progress = useGenerationProgress(job.id, running && !stalled);
  const image = useAuthedImage(job.id, job.status === 'completed');
  // The quick-edit bar's state; `quick.edited` replaces the image once a tool has run.
  const quick = useQuickEdit(job.id);
  const send = useSendToGenerate();

  if (stalled) {
    return (
      <Panel>
        <Icon name="alert" size={22} />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.stalledTitle')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.stalledBody')}
        </p>
        <Button icon="refresh" onClick={onCheckAgain}>
          {t('run.checkAgain')}
        </Button>
      </Panel>
    );
  }

  // Stopping a run keeps the record, so this asks for no confirmation — unlike
  // deleting, nothing is lost and the prompt and settings stay in the draft.
  const cancelButton = (
    <Button
      size="sm"
      variant="secondary"
      icon="close"
      busy={cancel.isPending}
      onClick={() => cancel.mutate(job.id)}
    >
      {t('run.cancelRun')}
    </Button>
  );

  // The frame the engine is filling, at the aspect ratio actually requested.
  const pendingFrame = (
    <div
      className="pending-frame"
      style={{ width: 420, aspectRatio: `${job.width} / ${job.height}` }}
      aria-hidden="true"
    />
  );

  if (job.status === 'pending') {
    return (
      <Panel>
        {pendingFrame}
        <Icon name="queue" size={22} strokeDasharray="3 3" />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.waiting')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.waitingBody')}
        </p>
        {progress.position !== null && progress.totalQueued !== null ? (
          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
            {t('run.queuePosition', {
              position: String(progress.position),
              total: String(progress.totalQueued),
            })}
          </span>
        ) : null}
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
          {formatElapsed(elapsed)}
        </span>
        {cancelButton}
      </Panel>
    );
  }

  if (job.status === 'processing') {
    return (
      <Panel>
        {pendingFrame}
        <Icon name="refresh" size={22} className="spin" />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.generating')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.generatingBody')}
        </p>
        {/*
          Determinate only when the backend reported a live measurement. It
          answers this endpoint even when it cannot reach the AI node, and an
          invented percentage is worse than no bar at all.
        */}
        {progress.ratio !== null ? (
          <div
            className="track"
            style={{ width: 200 }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
          >
            <div className="track__fill" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
        ) : (
          <div className="track" style={{ width: 200 }}>
            <div className="track__indeterminate" />
          </div>
        )}
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
          {progress.step !== null && progress.totalSteps !== null
            ? t('run.stepOf', {
                step: String(progress.step),
                total: String(progress.totalSteps),
                time: formatElapsed(elapsed),
              })
            : t('run.elapsed', { time: formatElapsed(elapsed) })}
        </span>
        {cancelButton}
      </Panel>
    );
  }

  // A cancelled run is stored as `failed`, so it would otherwise be reported as
  // an engine error the person should retry — which is not what happened.
  if (wasCancelled(job)) {
    return (
      <Panel>
        <Icon name="close" size={22} />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.cancelledTitle')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.cancelledBody')}
        </p>
        <Button icon="refresh" onClick={onRetry}>
          {t('run.tryAgain')}
        </Button>
      </Panel>
    );
  }

  if (job.status === 'failed') {
    return (
      <Panel>
        <Icon name="alert" size={22} />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.failedTitle')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.failedBody')}
        </p>
        <Button icon="refresh" onClick={onRetry}>
          {t('run.tryAgain')}
        </Button>
        {job.error_message ? (
          <details style={{ width: '100%' }}>
            <summary
              className="mono"
              style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', cursor: 'pointer' }}
            >
              error_message
            </summary>
            <p
              className="mono"
              style={{
                fontSize: 'var(--fs-2xs)',
                color: 'var(--ink-3)',
                textAlign: 'left',
                marginTop: 'var(--sp-8)',
                wordBreak: 'break-word',
              }}
            >
              {job.error_message}
            </p>
          </details>
        ) : null}
      </Panel>
    );
  }

  // A quick edit replaces the picture in place, as the spec's QuickEditBar
  // does; saving, reusing and the full view all follow what is showing.
  const { edited } = quick;
  const shownUrl = edited?.url ?? image.url;
  const editedName = edited?.tool ? t(toolMeta[edited.tool].label) : null;

  return (
    <div className="result">
      <div
        className={`result__media${shownUrl ? ' result__media--zoom' : ''}`}
        style={{ position: 'relative' }}
        onClick={() => shownUrl && setViewing(true)}
        title={shownUrl ? t('run.viewFull') : undefined}
      >
        {shownUrl ? (
          <img
            className={`img-in${edited?.tool === 'remove-bg' ? ' checker' : ''}`}
            src={shownUrl}
            alt={job.prompt}
          />
        ) : image.failed ? (
          <div style={{ padding: 'var(--sp-32)' }}>
            <Alert tone="error">{t('run.imageFailed')}</Alert>
          </div>
        ) : (
          <Icon name="image" size={22} />
        )}
        <ToolBusy tool={quick.pendingTool} />
      </div>

      <div className="result__bar">
        <span className="result__meta">
          {job.width} × {job.height} · {job.steps} steps · cfg {job.cfg_scale} ·{' '}
          {formatDuration(job.duration_seconds, language)}
          {editedName ? ` · ${editedName}` : ''}
        </span>
        <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
          <a
            className="btn btn--sm btn--secondary"
            href={shownUrl ?? undefined}
            download={edited ? `luma-${job.id}-${edited.tool}.png` : `luma-${job.id}.png`}
            aria-disabled={!shownUrl}
            onClick={() => shownUrl && showToast(t('run.savedImage'))}
            style={!shownUrl ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            <Icon name="download" size={14} />
            {t('run.saveImage')}
          </a>
          {/* An edited picture is not on the server yet, so it goes up first. */}
          <Button
            size="sm"
            busy={edited ? send.busy === 'source' : useAsSourceBusy}
            onClick={() => (edited ? void send.asSource(edited) : onUseAsSource())}
          >
            {t('run.startFromThis')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            onClick={() => setConfirming(true)}
            aria-label={t('run.delete')}
          >
            {t('run.delete')}
          </Button>
        </div>
      </div>

      {/* Offered once the run's own image has loaded: that is what the first tool runs on. */}
      {image.url ? <QuickEditBar runId={job.id} quick={quick} /> : null}

      {viewing && shownUrl ? (
        <ImageViewer
          url={shownUrl}
          alt={job.prompt}
          meta={`${job.width} × ${job.height}${editedName ? ` · ${editedName}` : ''}`}
          onClose={() => setViewing(false)}
        />
      ) : null}

      <DeleteRunDialog
        open={confirming}
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate(job.id)}
      />
    </div>
  );
}
