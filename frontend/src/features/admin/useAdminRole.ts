import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService.ts';
import { isApiError } from '../../contracts/errors.ts';

/**
 * Who the current person is inside the admin console, and what they may do.
 *
 * A 403 here is not a failure to report — it is the answer. It means "signed
 * in, but not an admin", which the guard turns into a redirect rather than an
 * error screen. Retrying it would only ask the same question again.
 */
export function useAdminRole() {
  const query = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => adminService.me(),
    retry: (_count, error) => !(isApiError(error) && error.status === 403),
    staleTime: 60_000,
  });

  const forbidden = isApiError(query.error) && query.error.status === 403;

  return {
    me: query.data ?? null,
    loading: query.isPending,
    forbidden,
    failed: query.isError && !forbidden,
    refetch: query.refetch,
  };
}
