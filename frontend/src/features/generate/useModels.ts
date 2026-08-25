import { useQuery } from '@tanstack/react-query';
import { systemService } from '../../services/systemService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import { checkpoints as bundledCheckpoints, loraOptions, type ModelOption } from '../../config/models.ts';

/**
 * What the model and style pickers should offer.
 *
 * Asks the backend for the AI node's real catalogue and falls back to the
 * bundled list when that is unavailable — a machine without the AI node up
 * should still be able to fill in the form, and the demo should not depend on
 * an endpoint that may not be deployed yet.
 */
export function useModels() {
  const query = useQuery({
    queryKey: queryKeys.models,
    queryFn: () => systemService.models(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const live = query.data?.available ? query.data : null;

  const toOption = (entry: { id: string; name: string }): ModelOption => ({
    id: entry.id,
    name: entry.name,
    // The node reports a filename; keep the bundled description when we have one.
    description:
      bundledCheckpoints.find((m) => m.id === entry.id)?.description ??
      loraOptions.find((m) => m.id === entry.id)?.description ??
      '',
  });

  return {
    checkpoints: live && live.checkpoints.length > 0 ? live.checkpoints.map(toOption) : bundledCheckpoints,
    loras:
      live && live.loras.length > 0
        ? [loraOptions[0], ...live.loras.map(toOption)]
        : loraOptions,
    /** True when the lists came from the machine rather than from the bundle. */
    fromNode: Boolean(live),
  };
}
