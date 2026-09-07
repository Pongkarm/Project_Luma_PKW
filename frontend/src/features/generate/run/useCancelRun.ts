import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generationService } from '../../../services/generationService.ts';
import { queryKeys } from '../../../services/queryKeys.ts';
import { useToasts } from '../../../shared/ui/Toast.tsx';
import { useT } from '../../../shared/hooks/useT.ts';
import { isApiError } from '../../../contracts/errors.ts';
import type { Generation } from '../../../contracts/generation.ts';

/**
 * Stop a run that has not finished.
 *
 * Unlike deleting, this keeps the record — the row stays, marked failed with
 * "Cancelled by user" — so nothing is lost and no confirmation is asked for.
 * The answer carries the updated run, which is written straight into the cache
 * so the stage stops polling on the same tick rather than a poll later.
 */
export function useCancelRun(onCancelled?: () => void) {
  const queryClient = useQueryClient();
  const showToast = useToasts((state) => state.show);
  const t = useT();

  return useMutation({
    mutationFn: (id: string) => generationService.cancel(id),
    onSuccess(run: Generation) {
      queryClient.setQueryData(queryKeys.generation(run.id), run);
      void queryClient.invalidateQueries({ queryKey: queryKeys.generationsAll });
      showToast(t('run.cancelled'));
      onCancelled?.();
    },
    onError(error) {
      // 409 means it finished while the click was in flight — not a failure to
      // report as one, so the fresh record is pulled in and nothing is claimed.
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.generationsAll });
        showToast(t('run.cancelTooLate'));
        return;
      }
      showToast(isApiError(error) ? error.message : t('run.cancelFailed'));
    },
  });
}
