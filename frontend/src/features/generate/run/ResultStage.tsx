import { Button } from '../../../shared/ui/Button.tsx';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { Alert } from '../../../shared/ui/Alert.tsx';
import { useAuthedImage } from '../../../shared/hooks/useAuthedImage.ts';
import { useElapsed } from '../../../shared/hooks/useElapsed.ts';
import { formatDuration, formatElapsed } from '../../../shared/utils/format.ts';
import type { Generation } from '../../../contracts/generation.ts';
import { useT } from '../../../shared/hooks/useT.ts';
import { useToasts } from '../../../shared/ui/Toast.tsx';

type Props = {
  job: Generation;
  stalled: boolean;
  startedAt: number | null;
  onRetry: () => void;
  onCheckAgain: () => void;
  onUseAsSource: () => void;
  useAsSourceBusy: boolean;
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
}: Props) {
  const t = useT();
  const showToast = useToasts((state) => state.show);
  const running = job.status === 'pending' || job.status === 'processing';
  const elapsed = useElapsed(startedAt ? new Date(startedAt) : null, running && !stalled);
  const image = useAuthedImage(job.id, job.status === 'completed');

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

  if (job.status === 'pending') {
    return (
      <Panel>
        <Icon name="queue" size={22} strokeDasharray="3 3" />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.waiting')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.waitingBody')}
        </p>
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
          {formatElapsed(elapsed)}
        </span>
      </Panel>
    );
  }

  if (job.status === 'processing') {
    return (
      <Panel>
        <Icon name="refresh" size={22} className="spin" />
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('run.generating')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('run.generatingBody')}
        </p>
        {/* Indeterminate on purpose: neither node reports a percentage. */}
        <div className="track" style={{ width: 200 }}>
          <div className="track__indeterminate" />
        </div>
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
          {t('run.elapsed', { time: formatElapsed(elapsed) })}
        </span>
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
                marginTop: 8,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div
        style={{
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
          background: 'var(--ph-image)',
          minWidth: 240,
          minHeight: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {image.url ? (
          <img
            className="img-in"
            src={image.url}
            alt={job.prompt}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '58vh' }}
          />
        ) : image.failed ? (
          <div style={{ padding: 32 }}>
            <Alert tone="error">{t('run.imageFailed')}</Alert>
          </div>
        ) : (
          <Icon name="image" size={22} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
          {job.width} × {job.height} · {job.steps} steps · cfg {job.cfg_scale} ·{' '}
          {formatDuration(job.duration_seconds)}
        </span>
        <div style={{ width: 1, height: 14, background: 'var(--line)' }} />
        {/*
          The file the backend serves is named .png; note that the AI node encodes
          WebP, so the bytes inside a live run may not match the extension.
        */}
        <a
          className="btn btn--sm btn--secondary"
          href={image.url ?? undefined}
          download={`luma-${job.id}.png`}
          aria-disabled={!image.url}
          onClick={() => image.url && showToast(t('run.savedImage'))}
          style={!image.url ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          <Icon name="download" size={14} />
          {t('run.saveImage')}
        </a>
        <Button size="sm" busy={useAsSourceBusy} onClick={onUseAsSource}>
          {t('run.startFromThis')}
        </Button>
      </div>
    </div>
  );
}
