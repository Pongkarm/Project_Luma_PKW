import { Button } from '../../shared/ui/Button.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { StatusChip } from '../../shared/ui/StatusChip.tsx';
import { useAuthedImage } from '../../shared/hooks/useAuthedImage.ts';
import { formatDateTime, formatDuration } from '../../shared/utils/format.ts';
import { uploadService } from '../../services/uploadService.ts';
import type { Generation } from '../../contracts/generation.ts';
import { useT } from '../../shared/hooks/useT.ts';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="eyebrow">{label}</span>
      <span className="mono" style={{ fontSize: 11.5 }}>
        {value}
      </span>
    </div>
  );
}

export function RunDetail({
  run,
  onReuseSettings,
}: {
  run: Generation;
  onReuseSettings: () => void;
}) {
  const image = useAuthedImage(run.id, run.status === 'completed');
  const t = useT();

  return (
    <aside className="controls" aria-label={t('history.details')}>
      <div className="stagebar">
        <span style={{ fontWeight: 600, fontSize: 13 }}>{t('history.details')}</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {run.id.slice(0, 8)}
        </span>
      </div>

      <div className="controls__scroll">
        <div
          style={{
            borderRadius: 'var(--r)',
            overflow: 'hidden',
            border: '1px solid var(--line)',
            background: 'var(--ph-image)',
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-3)',
          }}
        >
          {image.url ? (
            <img src={image.url} alt={run.prompt} style={{ width: '100%', display: 'block' }} />
          ) : run.status === 'completed' ? (
            <span className="skeleton" style={{ width: '100%', height: 160 }} />
          ) : (
            <div style={{ padding: 24 }}>
              <StatusChip status={run.status} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span className="eyebrow">{t('history.prompt')}</span>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{run.prompt}</p>
        </div>

        {run.negative_prompt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="eyebrow">{t('history.avoided')}</span>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              {run.negative_prompt}
            </p>
          </div>
        ) : null}

        {run.status === 'failed' && run.error_message ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="eyebrow">{t('history.whyFailed')}</span>
            <p
              className="mono"
              style={{ fontSize: 11, lineHeight: 1.55, color: 'var(--fail)', wordBreak: 'break-word' }}
            >
              {run.error_message}
            </p>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px' }}>
          <Fact label={t('history.mode')} value={run.task_type} />
          <Fact label={t('history.model')} value={run.model_name.replace(/\.safetensors$/, '')} />
          <Fact label={t('history.size')} value={`${run.width} × ${run.height}`} />
          <Fact label={t('history.stepsCfg')} value={`${run.steps} · ${run.cfg_scale}`} />
          <Fact label={t('history.sampler')} value={run.sampler_name} />
          <Fact label={t('history.took')} value={formatDuration(run.duration_seconds)} />
          {/* The seed actually used is never returned, so only what was sent can be shown. */}
          <Fact label={t('history.seedSent')} value={run.seed === null ? t('history.random') : String(run.seed)} />
          <Fact label={t('history.created')} value={formatDateTime(run.created_at)} />
        </div>

        {run.source_image_path ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="eyebrow">{t('history.startedFrom')}</span>
            <img
              src={uploadService.publicUrl(`/uploads/${run.source_image_path.split(/[\\/]/).pop()}`)}
              alt={t('history.startedFromAlt')}
              style={{
                width: 96,
                height: 96,
                objectFit: 'cover',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line)',
                background: 'var(--ph-image)',
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="controls__foot">
        {run.status === 'completed' ? (
          <a
            className="btn btn--primary btn--block"
            href={image.url ?? undefined}
            download={`luma-${run.id}.png`}
            aria-disabled={!image.url}
            style={!image.url ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            <Icon name="download" size={14} />
            {t('run.saveImage')}
          </a>
        ) : null}
        <Button block onClick={onReuseSettings}>
          {t('history.reuse')}
        </Button>
      </div>
    </aside>
  );
}
