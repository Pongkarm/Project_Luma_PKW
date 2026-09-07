import { useQuery } from '@tanstack/react-query';
import { generationService } from '../../../services/generationService.ts';
import { queryKeys } from '../../../services/queryKeys.ts';
import { polling } from '../../../config/polling.ts';
import {
  hasRealProgress,
  queueAhead,
  type GenerationProgress,
} from '../../../contracts/generation.ts';

export type ProgressView = {
  /** 0.0–1.0, and only when the engine actually measured it. Null draws the indeterminate bar. */
  ratio: number | null;
  /** The step the engine is on, when it reports one. */
  step: number | null;
  totalSteps: number | null;
  /** This job's place in the queue, only while something is genuinely ahead of it. */
  position: number | null;
  totalQueued: number | null;
};

const empty: ProgressView = {
  ratio: null,
  step: null,
  totalSteps: null,
  position: null,
  totalQueued: null,
};

/**
 * Queue position and live step count for a running job.
 *
 * This is deliberately a second query rather than more fields on the first.
 * Status decides whether a run is over and must be trusted; progress is a
 * best-effort read of a machine that may not answer, and a failure to get it
 * should slow nothing down and change no decision. So it retries nothing, is
 * enabled only while a run is unfinished, and returns nulls when the backend
 * reports `live: false` — the stage already knows how to show an indeterminate
 * bar, and that is the honest thing to show when nothing was measured.
 */
export function useGenerationProgress(id: string | null, active: boolean): ProgressView {
  const query = useQuery({
    queryKey: id ? queryKeys.progress(id) : ['generation', 'none', 'progress'],
    queryFn: ({ signal }) => generationService.progress(id as string, signal),
    enabled: Boolean(id) && active,
    retry: false,
    // Never served from cache: a step count a few seconds old is not progress.
    staleTime: 0,
    gcTime: 0,
    refetchIntervalInBackground: false,
    refetchInterval: active ? polling.progressMs : false,
  });

  const data: GenerationProgress | undefined = query.data;
  if (!data) return empty;

  const measured = hasRealProgress(data);
  const position = queueAhead(data);
  // A step counter is only worth printing once it has counted something:
  // "step 0 of 20" is what a job looks like in the instant before it starts.
  const stepping = measured && (data.step ?? 0) > 0 && (data.total_steps ?? 0) > 0;

  return {
    ratio: measured ? Math.min(1, Math.max(0, data.progress ?? 0)) : null,
    step: stepping ? data.step : null,
    totalSteps: stepping ? data.total_steps : null,
    position,
    totalQueued: position === null ? null : data.total_queued,
  };
}
