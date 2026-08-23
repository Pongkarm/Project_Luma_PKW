import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { generationService } from '../../services/generationService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import { useAuthedImage } from '../../shared/hooks/useAuthedImage.ts';
import { IconButton } from '../../shared/ui/Button.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { StatusChip } from '../../shared/ui/StatusChip.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { truncate } from '../../shared/utils/format.ts';
import type { Generation } from '../../contracts/generation.ts';
import { RunDetail } from './RunDetail.tsx';
import { useDraft } from '../generate/draftStore.ts';

const PAGE_SIZE = 24;

function RunCard({ run, active, onSelect }: { run: Generation; active: boolean; onSelect: () => void }) {
  const image = useAuthedImage(run.id, run.status === 'completed');

  return (
    // A card, not a <button>: the whole tile is the target, and a button's
    // anonymous inner box makes multi-line captions awkward to size.
    <div
      className="runcard"
      role="button"
      tabIndex={0}
      aria-current={active}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="runcard__media">
        {image.url ? (
          <img src={image.url} alt="" />
        ) : run.status === 'completed' ? (
          <span className="skeleton" style={{ width: '100%', height: '100%' }} />
        ) : run.status === 'failed' ? (
          <>
            <Icon name="xCircle" size={18} />
            <span style={{ fontSize: 11.5, padding: '0 16px', textAlign: 'center', lineHeight: 1.5 }}>
              {truncate(run.error_message ?? 'The engine could not finish this run', 70)}
            </span>
          </>
        ) : (
          <>
            <Icon
              name={run.status === 'processing' ? 'refresh' : 'queue'}
              size={18}
              className={run.status === 'processing' ? 'spin' : undefined}
              strokeDasharray={run.status === 'pending' ? '3 3' : undefined}
            />
            <div className="track" style={{ width: '60%' }}>
              <div className="track__indeterminate" />
            </div>
          </>
        )}
        <span className="runcard__badge">
          <StatusChip status={run.status} />
        </span>
      </div>
      <div className="runcard__body">
        <span className="runcard__prompt">{run.prompt}</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {run.task_type} · {run.width}×{run.height}
        </span>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const draft = useDraft();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.generations(page, PAGE_SIZE),
    queryFn: () => generationService.list({ page, page_size: PAGE_SIZE }),
  });

  const runs = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = runs.find((run) => run.id === selectedId) ?? null;

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function reuse(run: Generation) {
    draft.patch({
      prompt: run.prompt,
      negativePrompt: run.negative_prompt ?? '',
      modelName: run.model_name,
      samplerName: run.sampler_name,
      steps: run.steps,
      cfgScale: run.cfg_scale,
      width: run.width,
      height: run.height,
      // The seed that was actually used is never returned, so only a seed the
      // person chose themselves can be carried over.
      seed: run.seed === null ? '' : String(run.seed),
    });
    draft.setMode('txt2img');
    navigate('/generate');
  }

  return (
    <div className="app__workspace">
      <main className="main">
        <div className="stagebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>History</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {total} {total === 1 ? 'run' : 'runs'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {from}–{to} of {total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <IconButton
                icon="chevronLeft"
                label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              />
              <IconButton
                icon="chevronRight"
                label="Next page"
                disabled={page >= lastPage}
                onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
              />
            </div>
          </div>
        </div>

        {isError ? (
          <div style={{ padding: 16 }}>
            <Alert tone="error">Your history could not be loaded.</Alert>
          </div>
        ) : isLoading ? (
          <div className="grid-runs">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="runcard">
                <span className="skeleton" style={{ height: 150 }} />
                <div className="runcard__body">
                  <span className="skeleton" style={{ height: 10, width: '80%' }} />
                  <span className="skeleton" style={{ height: 9, width: '52%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="stage">
            <div className="centered-note">
              <Icon name="clock" size={22} />
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>No runs yet</h2>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                Everything you generate is kept here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid-runs">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                active={run.id === selectedId}
                onSelect={() => navigate(`/history/${run.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {selected ? <RunDetail run={selected} onReuseSettings={() => reuse(selected)} /> : null}
    </div>
  );
}
