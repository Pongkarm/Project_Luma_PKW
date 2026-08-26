import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { adminService } from '../../services/adminService.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { formatDateTime } from '../../shared/utils/format.ts';
import { isApiError } from '../../contracts/errors.ts';
import type { AdminMe } from '../../contracts/admin.ts';
import { AdminSkeletonRows, AdminUnavailable } from './AdminStates.tsx';

const ROLES = ['reviewer', 'admin', 'owner'] as const;

/**
 * Who holds power, and how it changes. A short page with the highest stakes on
 * the site, so every control here states its consequence before it acts.
 *
 * A role is granted to a registered user picked from the list, never to a typed
 * email address. You cannot hand power to somebody who does not exist yet, and
 * a mistyped address is a quiet way to leave a door open for whoever registers
 * it later.
 */
export function AdminAdmins() {
  const me = useOutletContext<AdminMe>();
  const queryClient = useQueryClient();
  const [granting, setGranting] = useState(false);
  const [pick, setPick] = useState('');
  const [role, setRole] = useState<string>('reviewer');

  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminService.roles() });
  const candidates = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: () => adminService.users({ page_size: 100 }),
    enabled: granting,
  });

  const change = useMutation({
    mutationFn: (v: { id: string; role: string | null }) =>
      v.role === null ? adminService.revokeRole(v.id) : adminService.assignRole(v.id, v.role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      setGranting(false);
      setPick('');
    },
  });

  if (roles.isError) return <AdminUnavailable onRetry={() => void roles.refetch()} />;

  const held = roles.data ?? [];
  const owners = held.filter((r) => r.role === 'owner').length;
  const free = (candidates.data?.items ?? []).filter(
    (u) => !held.some((r) => r.user_id === u.id),
  );

  return (
    <>
      <header className="adm__head">
        <h1>Admins</h1>
        <p className="adm__sub">{held.length} people hold a role · only an owner can change this</p>
      </header>

      {change.isError ? (
        <Alert tone="error">
          {isApiError(change.error) ? change.error.message : 'The change was refused.'}
        </Alert>
      ) : null}

      <p className="adm-desktoponly">
        Granting and revoking roles is a desktop task. On a narrow screen the
        table scrolls sideways and the controls end up out of reach, so open
        this page on a computer.
      </p>

      {roles.isPending ? (
        <AdminSkeletonRows rows={3} />
      ) : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Granted by</th>
                <th>Since</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {held.map((r) => {
                const self = r.user_id === me.user_id;
                const lastOwner = r.role === 'owner' && owners <= 1;
                const locked = lastOwner
                  ? 'The last owner cannot be removed — nobody could grant the role back.'
                  : self
                    ? 'You cannot lower your own role.'
                    : null;
                return (
                  <tr key={r.user_id}>
                    <td>
                      {r.username}
                      {self ? <span className="adm-tag">you</span> : null}
                    </td>
                    <td>
                      <select
                        className="input select"
                        value={r.role}
                        disabled={Boolean(locked) || change.isPending}
                        title={locked ?? undefined}
                        aria-label={`Role for ${r.username}`}
                        onChange={(event) =>
                          change.mutate({ id: r.user_id, role: event.target.value })
                        }
                      >
                        {ROLES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{r.granted_by_username ?? 'set up at install'}</td>
                    <td>{formatDateTime(r.granted_at)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(locked) || change.isPending}
                        title={locked ?? undefined}
                        onClick={() => change.mutate({ id: r.user_id, role: null })}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="adm-act">
        {!granting ? (
          <Button icon="user" onClick={() => setGranting(true)}>
            Grant a role
          </Button>
        ) : (
          <>
            <p className="adm-act__ask">
              Roles are granted to people who already have a LUMA account.
            </p>
            <div className="adm-act__row">
              <select
                className="input select"
                value={pick}
                aria-label="Person"
                onChange={(event) => setPick(event.target.value)}
              >
                <option value="">Choose a person…</option>
                {free.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <select
                className="input select"
                value={role}
                aria-label="Role"
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                disabled={!pick}
                busy={change.isPending}
                onClick={() => change.mutate({ id: pick, role })}
              >
                Grant
              </Button>
              <Button variant="ghost" onClick={() => setGranting(false)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
