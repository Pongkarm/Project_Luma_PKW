import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService.ts';
import { formatDateTime } from '../../shared/utils/format.ts';
import { AdminEmpty, AdminSkeletonRows, AdminUnavailable } from './AdminStates.tsx';

const VERBS: Record<string, string> = {
  'user.disable': 'disabled',
  'user.enable': 'enabled',
};

/**
 * Who did what, and when — the question only ever asked after something has
 * already gone wrong.
 *
 * Written as sentences naming people, not as rows of identifiers. An audit log
 * that reads as UUIDs gets ignored, and an ignored log is the same as no log.
 * There is no delete and no edit here, and none on the server either.
 */
export function AdminAudit() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => adminService.audit(1),
  });

  if (isError) return <AdminUnavailable onRetry={() => void refetch()} />;

  return (
    <>
      <header className="adm__head">
        <h1>Audit</h1>
        <p className="adm__sub">
          {data ? `${data.total} recorded actions · read-only` : 'Read-only'}
        </p>
      </header>

      {isPending ? (
        <AdminSkeletonRows rows={6} height={32} />
      ) : data.items.length === 0 ? (
        <AdminEmpty
          title="Nothing has been recorded yet"
          body="Actions that change an account will appear here as they happen."
        />
      ) : (
        <ol className="adm-audit">
          {data.items.map((e) => (
            <li key={e.id}>
              <span className="adm-audit__when">{formatDateTime(e.created_at)}</span>
              <span className="adm-audit__what">
                <strong>{e.actor_username}</strong>{' '}
                {VERBS[e.action] ?? e.action}{' '}
                <strong>{e.detail?.username ?? e.target_id?.slice(0, 8) ?? '—'}</strong>
                {e.detail?.reason ? <em> — {e.detail.reason}</em> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
