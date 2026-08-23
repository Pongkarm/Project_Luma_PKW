import { Button } from '../../../shared/ui/Button.tsx';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { Alert } from '../../../shared/ui/Alert.tsx';
import { useAuthedImage } from '../../../shared/hooks/useAuthedImage.ts';
import { useElapsed } from '../../../shared/hooks/useElapsed.ts';
import { formatDuration, formatElapsed } from '../../../shared/utils/format.ts';
import type { Generation } from '../../../contracts/generation.ts';

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
  const running = job.status === 'pending' || job.status === 'processing';
  const elapsed = useElapsed(startedAt ? new Date(startedAt) : null, running && !stalled);
  const image = useAuthedImage(job.id, job.status === 'completed');

  if (stalled) {
    return (
      <Panel>
        <Icon name="alert" size={22} />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>This is taking unusually long</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          The job is still marked as processing. It may finish, or the engine may have lost it — we
          stopped checking after five minutes.
        </p>
        <Button icon="refresh" onClick={onCheckAgain}>
          Check again
        </Button>
      </Panel>
    );
  }

  if (job.status === 'pending') {
    return (
      <Panel>
        <Icon name="queue" size={22} strokeDasharray="3 3" />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Waiting for the GPU</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          One job runs at a time. Yours starts as soon as the engine is free.
        </p>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {formatElapsed(elapsed)}
        </span>
      </Panel>
    );
  }

  if (job.status === 'processing') {
    return (
      <Panel>
        <Icon name="refresh" size={22} className="spin" />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Generating</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Usually 30–40 seconds. You can leave this page; the run keeps going.
        </p>
        {/* Indeterminate on purpose: neither node reports a percentage. */}
        <div className="track" style={{ width: 200 }}>
          <div className="track__indeterminate" />
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {formatElapsed(elapsed)} elapsed
        </span>
      </Panel>
    );
  }

  if (job.status === 'failed') {
    return (
      <Panel>
        <Icon name="alert" size={22} />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>The engine couldn't finish this run</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Your prompt and settings are still here. Try again, or make the image smaller.
        </p>
        <Button icon="refresh" onClick={onRetry}>
          Try again
        </Button>
        {job.error_message ? (
          <details style={{ width: '100%' }}>
            <summary
              className="mono"
              style={{ fontSize: 10.5, color: 'var(--ink-3)', cursor: 'pointer' }}
            >
              error_message
            </summary>
            <p
              className="mono"
              style={{
                fontSize: 10.5,
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
            src={image.url}
            alt={job.prompt}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '58vh' }}
          />
        ) : image.failed ? (
          <div style={{ padding: 32 }}>
            <Alert tone="error">The finished image could not be loaded.</Alert>
          </div>
        ) : (
          <Icon name="image" size={22} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
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
          style={!image.url ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          <Icon name="download" size={14} />
          Save image
        </a>
        <Button size="sm" busy={useAsSourceBusy} onClick={onUseAsSource}>
          Start from this
        </Button>
      </div>
    </div>
  );
}
