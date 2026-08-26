import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/adminService.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { formatDateTime } from '../../shared/utils/format.ts';
import type { AdminMe, AdminUserRow } from '../../contracts/admin.ts';
import { AdminEmpty, AdminSkeletonRows, AdminUnavailable } from './AdminStates.tsx';
import { StatusControl } from './StatusControl.tsx';

/**
 * Find one person and understand their standing.
 *
 * Filters live in the URL so a filtered view can be pasted to a teammate, and
 * so the browser's back button behaves. Sorted by last generated rather than
 * by last sign-in: last_login_at only started being recorded recently, and
 * somebody who signs in and generates nothing is not really an active user.
 */
export function AdminUsers() {
  const me = useOutletContext<AdminMe>();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const activeWithin = params.get('active_within');
  const page = Number(params.get('page') ?? 1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', q, status, activeWithin, page],
    queryFn: () =>
      adminService.users({
        q: q || undefined,
        status: status || undefined,
        active_within: activeWithin ? Number(activeWithin) : undefined,
        page,
      }),
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }

  if (isError) return <AdminUnavailable onRetry={() => void refetch()} />;

  const rows = data?.items ?? [];
  const filtered = Boolean(q || status || activeWithin);

  return (
    <>
      <header className="adm__head">
        <h1>Users</h1>
        <p className="adm__sub">
          {data ? `${data.total} total` : ' '}
          {me.role === 'reviewer' ? ' · emails partly hidden at your access level' : ''}
        </p>
      </header>

      <div className="adm-filters">
        <label className="adm-search">
          <Icon name="sliders" size={14} />
          <input
            className="input"
            type="search"
            placeholder="Search username or email"
            defaultValue={q}
            onChange={(event) => setParam('q', event.target.value)}
            aria-label="Search users"
          />
        </label>
        <select
          className="input select"
          value={status}
          onChange={(event) => setParam('status', event.target.value)}
          aria-label="Account status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          className="input select"
          value={activeWithin ?? ''}
          onChange={(event) => setParam('active_within', event.target.value)}
          aria-label="Recent activity"
        >
          <option value="">Any activity</option>
          <option value="7">Generated in 7 days</option>
          <option value="30">Generated in 30 days</option>
          <option value="0">Never generated</option>
        </select>
      </div>

      {isPending ? (
        <AdminSkeletonRows rows={8} />
      ) : rows.length === 0 ? (
        <AdminEmpty
          title={filtered ? 'No users match these filters' : 'No users have registered yet'}
          body={
            filtered
              ? 'Clearing the filters will show everyone.'
              : 'People who sign up will appear here.'
          }
          action={
            filtered ? (
              <Button icon="refresh" onClick={() => setParams(new URLSearchParams())}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last generated</th>
                <th className="num">Runs</th>
                <th className="num">Failed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u)} tabIndex={0}>
                  <td>
                    {u.username}
                    {u.admin_role ? <span className="adm-tag">{u.admin_role}</span> : null}
                  </td>
                  <td className="mono">{u.email}</td>
                  <td>
                    <span className={`adm-st adm-st--${u.is_active ? 'on' : 'off'}`}>
                      {u.is_active ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td>{u.last_generated_at ? formatDateTime(u.last_generated_at) : '—'}</td>
                  <td className="num">{u.generation_count}</td>
                  <td className="num">{u.failure_count || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? <UserDrawer user={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

/** A drawer rather than a page, so the list keeps its scroll position. */
function UserDrawer({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['admin', 'user', user.id],
    queryFn: () => adminService.user(user.id),
  });

  return (
    <>
      <div className="adm-scrim" onClick={onClose} />
      <aside className="adm-drawer" aria-label={`Details for ${user.username}`}>
        <header>
          <h2>{user.username}</h2>
          <Button size="sm" variant="ghost" icon="close" onClick={onClose}>
            Close
          </Button>
        </header>
        <dl className="adm-facts">
          <div>
            <dt>Email</dt>
            <dd className="mono">{user.email}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{user.is_active ? 'Active' : 'Disabled'}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{formatDateTime(user.created_at)}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{user.last_login_at ? formatDateTime(user.last_login_at) : 'Not since recording began'}</dd>
          </div>
          <div>
            <dt>Runs</dt>
            <dd>
              {user.generation_count} total · {user.failure_count} failed
            </dd>
          </div>
        </dl>

        <h3>Recent runs</h3>
        {data ? (
          data.recent_runs.length === 0 ? (
            <p className="adm-panel__empty">This user has not generated anything.</p>
          ) : (
            <ul className="adm-runs">
              {data.recent_runs.map((r) => (
                <li key={r.id}>
                  <span className={`adm-st adm-st--${r.status === 'failed' ? 'off' : 'on'}`}>
                    {r.status}
                  </span>
                  <span className="adm-runs__meta mono">
                    {r.task_type} · {r.width}×{r.height}
                  </span>
                  <span className="adm-runs__when">{formatDateTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <AdminSkeletonRows rows={4} height={28} />
        )}

        <StatusControl user={data?.user ?? user} onDone={onClose} />
      </aside>
    </>
  );
}
