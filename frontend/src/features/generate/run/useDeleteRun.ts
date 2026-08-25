import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generationService } from '../../../services/generationService.ts';
import { queryKeys } from '../../../services/queryKeys.ts';
import { useToasts } from '../../../shared/ui/Toast.tsx';
import { useT } from '../../../shared/hooks/useT.ts';
import { isApiError } from '../../../contracts/errors.ts';

/**
 * Deleting a run removes the image and its record for good, so the caller is
 * expected to confirm first. This only handles the request and the aftermath:
 * refreshing the lists and the profile count, and saying what happened.
 */
export function useDeleteRun(onDeleted?: () => void) {
  const queryClient = useQueryClient();
  const showToast = useToasts((state) => state.show);
  const t = useT();

  return useMutation({
    mutationFn: (id: string) => generationService.remove(id),
    onSuccess(_result, id) {
      queryClient.removeQueries({ queryKey: queryKeys.generation(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.generationsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      showToast(t('run.deleted'));
      onDeleted?.();
    },
    onError(error) {
      showToast(isApiError(error) ? error.message : t('run.deleteFailed'));
    },
  });
}
