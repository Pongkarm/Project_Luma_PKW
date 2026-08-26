import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService.ts';
import { AdminSkeletonRows, AdminUnavailable } from './AdminStates.tsx';

/**
 * Two questions, one screen: is the system healthy, and is anyone using it.
 *
 * Six figures, because six can be read at a glance and fourteen cannot — the
 * important one would hide among the rest. Every figure states its own window,
 * since "active" means nothing without "in the last N days".
 */
export function AdminOverview() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'stats', 14],
    queryFn: () => adminService.stats(14),
  });

  if (isError) return <AdminUnavailable onRetry={() => void refetch()} />;

  const days = data?.window_days ?? 14;

  return (
    <>
      <header className="adm__head">
        <h1>Overview</h1>
        <p className="adm__sub">Last {days} days unless stated otherwise</p>
      </header>

      {isPending ? (
        <AdminSkeletonRows rows={3} height={72} />
      ) : (
        <>
          <div className="adm-figs">
            <Figure label="Users" value={data.total_users} to="/admin/users" />
            <Figure
              label={`Generated in ${days}d`}
              value={data.active_users}
              to="/admin/users?active_within=14"
            />
            <Figure
              label="Disabled"
              value={data.disabled_users}
              to="/admin/users?status=disabled"
              tone={data.disabled_users > 0 ? 'warn' : undefined}
            />
            <Figure label="Runs 24h" value={data.generations_24h} to="/admin/activity" />
            <Figure
              label="Success"
              value={`${Math.round(data.success_rate * 100)}%`}
              to="/admin/activity?status=failed"
              tone={data.success_rate < 0.9 ? 'warn' : 'ok'}
            />
            <Figure
              label="Median time"
              value={data.median_duration_seconds === null ? '—' : `${data.median_duration_seconds}s`}
            />
          </div>

          <div className="adm-panels">
            <section className="adm-panel">
              <h2>Failures</h2>
              {data.failures.length === 0 ? (
                <p className="adm-panel__empty">No failed runs in {days} days.</p>
              ) : (
                <ul className="adm-fails">
                  {data.failures.map((f) => (
                    <li key={f.message}>
                      <span className="adm-fails__n">{f.count}</span>
                      <span className="adm-fails__msg" title={f.message}>
                        {f.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="adm-panel">
              <h2>Usage</h2>
              <Bars points={data.per_day} />
              <ul className="adm-mix">
                {data.by_task.map((t) => (
                  <li key={t.name}>
                    <span>{t.name}</span>
                    <span className="mono">{t.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}

/** A number you cannot drill into is trivia, so most of these are links. */
function Figure({
  label,
  value,
  to,
  tone,
}: {
  label: string;
  value: number | string;
  to?: string;
  tone?: 'ok' | 'warn';
}) {
  const body = (
    <>
      <span className={`adm-fig__v${tone ? ` adm-fig__v--${tone}` : ''}`}>{value}</span>
      <span className="adm-fig__l">{label}</span>
    </>
  );
  return to ? (
    <Link className="adm-fig adm-fig--link" to={to}>
      {body}
    </Link>
  ) : (
    <div className="adm-fig">{body}</div>
  );
}

function Bars({ points }: { points: { day: string; total: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.total));
  return (
    <div className="adm-bars" role="img" aria-label={`Runs per day over ${points.length} days`}>
      {points.map((p) => (
        <span
          key={p.day}
          className="adm-bars__b"
          style={{ height: `${Math.max(4, (p.total / max) * 100)}%` }}
          title={`${p.day.slice(0, 10)} — ${p.total}`}
        />
      ))}
    </div>
  );
}
