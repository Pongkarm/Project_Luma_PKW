import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from '../../shared/ui/Icon.tsx';
import { useAdminRole } from './useAdminRole.ts';
import { AdminForbidden, AdminUnavailable } from './AdminStates.tsx';

type Item = { to: string; label: string; icon: IconName; needs?: 'users' | 'audit' | 'admins' };

const ITEMS: Item[] = [
  { to: '/admin', label: 'Overview', icon: 'generate' },
  { to: '/admin/users', label: 'Users', icon: 'user' },
  { to: '/admin/activity', label: 'Activity', icon: 'clock' },
  { to: '/admin/audit', label: 'Audit', icon: 'layers', needs: 'audit' },
  { to: '/admin/admins', label: 'Admins', icon: 'lock', needs: 'admins' },
];

/**
 * The console shell.
 *
 * The sidebar is built from the server's answer, not from a guess: a section
 * the current role cannot open is not rendered at all. That is a courtesy, not
 * a defence — each endpoint refuses on its own — but it means an admin never
 * clicks something that will turn them away.
 *
 * The current role is always visible in the footer. Somebody who cannot find a
 * control should be able to see why in the same glance.
 */
export function AdminLayout() {
  const { me, loading, forbidden, failed, refetch } = useAdminRole();

  if (loading) return <div className="adm-boot">Checking your access…</div>;
  if (forbidden) return <AdminForbidden />;
  if (failed || !me) return <AdminUnavailable onRetry={() => void refetch()} />;

  const allowed = ITEMS.filter((item) => {
    if (item.needs === 'audit') return me.can_view_audit;
    if (item.needs === 'admins') return me.can_manage_admins;
    return true;
  });

  return (
    <div className="adm">
      <nav className="adm__rail" aria-label="Admin sections">
        <span className="adm__brand">
          LUMA<span>ADMIN</span>
        </span>
        <div className="adm__nav">
          {allowed.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) => `adm__link${isActive ? ' adm__link--on' : ''}`}
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="adm__who">
          <span className="adm__whoName">{me.username}</span>
          <span className="adm__whoRole">{me.role}</span>
        </div>
      </nav>
      <main className="adm__main">
        <Outlet context={me} />
      </main>
    </div>
  );
}
