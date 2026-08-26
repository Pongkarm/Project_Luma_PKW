import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { generationService } from '../../../services/generationService.ts';
import { queryKeys } from '../../../services/queryKeys.ts';
import { useAuthedImage } from '../../../shared/hooks/useAuthedImage.ts';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { statusPresentation } from '../../../shared/ui/statusPresentation.ts';
import { useT } from '../../../shared/hooks/useT.ts';
import type { Generation } from '../../../contracts/generation.ts';

const STRIP_SIZE = 12;

function RunThumb({
  run,
  active,
  onSelect,
}: {
  run: Generation;
  active: boolean;
  onSelect: () => void;
}) {
  const image = useAuthedImage(run.id, run.status === 'completed');
  const t = useT();
  const label = t(statusPresentation[run.status].labelKey);

  return (
    <button
      type="button"
      className="thumb"
      aria-current={active}
      onClick={onSelect}
      title={`${label} · ${run.prompt}`}
    >
      {image.url ? (
        <img className="img-in" src={image.url} alt="" />
      ) : run.status === 'failed' ? (
        <Icon name="xCircle" size={16} />
      ) : run.status === 'completed' ? (
        <span className="skeleton" style={{ width: '100%', height: '100%' }} />
      ) : (
        <Icon
          name={run.status === 'processing' ? 'refresh' : 'queue'}
          size={16}
          className={run.status === 'processing' ? 'spin' : undefined}
          strokeDasharray={run.status === 'pending' ? '3 3' : undefined}
        />
      )}
      <span className="visually-hidden">
        {label}: {run.prompt}
      </span>
    </button>
  );
}

export function RunStrip({
  activeRunId,
  onSelect,
}: {
  activeRunId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.generations(1, STRIP_SIZE),
    queryFn: () => generationService.list({ page: 1, page_size: STRIP_SIZE }),
  });

  const runs = data?.items ?? [];

  // Only a genuinely empty history hides the strip. A failed request used to
  // take the same path, so a row of twelve images would vanish without a word
  // and look like the runs had been lost.
  if (!isPending && !isError && runs.length === 0) return null;

  return (
    <div className="runstrip">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="eyebrow">{t('run.recent')}</span>
        <Link to="/history" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
          {t('run.openHistory')}
        </Link>
      </div>
      {isError ? (
        <div className="runstrip__note">
          <Icon name="alert" size={14} />
          <span>{t('run.recentFailed')}</span>
          <button type="button" className="linklike" onClick={() => void refetch()}>
            {t('run.tryAgain')}
          </button>
        </div>
      ) : (
        <div className="runstrip__row">
          {isPending
            ? Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="thumb thumb--loading">
                  <span className="skeleton" style={{ width: '100%', height: '100%' }} />
                </span>
              ))
            : runs.map((run) => (
                <RunThumb
                  key={run.id}
                  run={run}
                  active={run.id === activeRunId}
                  onSelect={() => onSelect(run.id)}
                />
              ))}
        </div>
      )}
    </div>
  );
}
