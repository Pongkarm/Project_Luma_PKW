import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { generationService } from '../../../services/generationService.ts';
import { queryKeys } from '../../../services/queryKeys.ts';
import { useAuthedImage } from '../../../shared/hooks/useAuthedImage.ts';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { statusLabel } from '../../../shared/ui/statusPresentation.ts';
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

  return (
    <button
      type="button"
      className="thumb"
      aria-current={active}
      onClick={onSelect}
      title={`${statusLabel(run.status)} · ${run.prompt}`}
    >
      {image.url ? (
        <img src={image.url} alt="" />
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
        {statusLabel(run.status)}: {run.prompt}
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
  const { data } = useQuery({
    queryKey: queryKeys.generations(1, STRIP_SIZE),
    queryFn: () => generationService.list({ page: 1, page_size: STRIP_SIZE }),
  });

  const runs = data?.items ?? [];
  if (runs.length === 0) return null;

  return (
    <div className="runstrip">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="eyebrow">Recent runs</span>
        <Link to="/history" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          Open history
        </Link>
      </div>
      <div className="runstrip__row">
        {runs.map((run) => (
          <RunThumb
            key={run.id}
            run={run}
            active={run.id === activeRunId}
            onSelect={() => onSelect(run.id)}
          />
        ))}
      </div>
    </div>
  );
}
