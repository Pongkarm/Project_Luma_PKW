import { useQuery } from '@tanstack/react-query';
import { systemService } from '../../services/systemService.ts';
import { queryKeys } from '../../services/queryKeys.ts';

/**
 * The backend's own account of itself, polled gently.
 *
 * Shared rather than local to the top bar because the generate panel needs the
 * inference mode too: in callback mode the backend drops several of the values
 * the panel collects, and a control that cannot affect the result should not
 * pretend otherwise.
 */
export function useEngineStatus() {
  return useQuery({
    queryKey: queryKeys.engineStatus,
    queryFn: () => systemService.engineStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
