import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { generationService } from '../../../services/generationService.ts';
import { queryKeys } from '../../../services/queryKeys.ts';
import { polling } from '../../../config/polling.ts';
import { isTerminal, type Generation } from '../../../contracts/generation.ts';

export type JobView = {
  job: Generation | null;
  isLoading: boolean;
  /**
   * The job is still unfinished well past any plausible run time and polling has
   * stopped. The backend never times a row out — a lost callback leaves it at
   * `processing` forever — so this is the client being honest rather than
   * spinning until the tab is closed.
   */
  stalled: boolean;
  refetch: () => void;
};

/**
 * Watch one job until it reaches a terminal state.
 *
 * The API exposes no progress, no queue position and no step counter, so this
 * polls `status` and nothing more: fast at first, slower after a minute, and
 * stopped once the job finishes or the give-up threshold passes.
 */
export function useGenerationJob(id: string | null, startedAt: number | null): JobView {
  const queryClient = useQueryClient();
  const watchStart = useRef<number | null>(null);
  const previousStatus = useRef<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // One place decides when watching began, and it is never read during render.
  useEffect(() => {
    previousStatus.current = null;
    setStalled(false);
    if (!id) {
      watchStart.current = null;
      return;
    }
    const begun = startedAt ?? Date.now();
    watchStart.current = begun;
    const remaining = polling.giveUpAfterMs - (Date.now() - begun);
    const timer = window.setTimeout(() => setStalled(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [id, startedAt, attempt]);

  const query = useQuery({
    queryKey: id ? queryKeys.generation(id) : ['generation', 'none'],
    queryFn: ({ signal }) => generationService.get(id as string, signal),
    enabled: Boolean(id),
    refetchIntervalInBackground: false,
    refetchInterval: (q) => {
      const data = q.state.data as Generation | undefined;
      if (!data) return polling.fastMs;
      if (isTerminal(data.status)) return false;
      const begun = watchStart.current ?? Date.now();
      const watched = Date.now() - begun;
      if (watched > polling.giveUpAfterMs) return false;
      return watched > polling.slowAfterMs ? polling.slowMs : polling.fastMs;
    },
  });

  const job = query.data ?? null;

  // A finished job changes the history list and the profile's run count.
  useEffect(() => {
    if (!job) return;
    if (previousStatus.current && previousStatus.current !== job.status && isTerminal(job.status)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.generationsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    }
    previousStatus.current = job.status;
  }, [job, queryClient]);

  const refetch = useCallback(() => {
    setAttempt((value) => value + 1);
    void query.refetch();
  }, [query]);

  return {
    job,
    isLoading: query.isLoading,
    stalled: stalled && Boolean(job) && !isTerminal((job as Generation).status),
    refetch,
  };
}
