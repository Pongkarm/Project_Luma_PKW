import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from '../../shared/ui/Icon.tsx';
import { IconButton } from '../../shared/ui/Button.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { usePreferences } from '../../shared/stores/preferencesStore.ts';
import { AiModeBadge, EngineIndicator } from './EngineIndicator.tsx';
import { SessionExpiredDialog } from '../auth/SessionExpiredDialog.tsx';

type NavItem = { to: string; label: string; icon: IconName; count?: number };

export function AppShell() {
  const user = useSession((state) => state.user);
  const theme = usePreferences((state) => state.theme);
  const toggleTheme = usePreferences((state) => state.toggleTheme);

  const items: NavItem[] = [
    { to: '/generate', label: 'Generate', icon: 'generate' },
    { to: '/history', label: 'History', icon: 'clock', count: user?.total_generations },
    { to: '/account', label: 'Account', icon: 'user' },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/generate" className="brand">
          <span className="brand__mark" aria-hidden="true">
            L
          </span>
          <span className="brand__word">LUMA</span>
        </NavLink>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AiModeBadge />
          <IconButton
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
            onClick={toggleTheme}
          />
          <NavLink
            to="/account"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--ink-2)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Icon name="user" size={15} />
            {user?.username ?? 'Account'}
            {user ? (
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {user.total_generations}
              </span>
            ) : null}
          </NavLink>
        </div>
      </header>

      <div className="app__body">
        <nav className="rail" aria-label="Sections">
          <div className="rail__nav">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className="rail__link" title={item.label}>
                <Icon name={item.icon} size={16} />
                <span className="rail__label">{item.label}</span>
                {item.count !== undefined ? <span className="rail__count">{item.count}</span> : null}
              </NavLink>
            ))}
          </div>
          <div className="rail__foot">
            <span className="eyebrow">Engine</span>
            <EngineIndicator />
          </div>
        </nav>

        <Outlet />
      </div>

      <nav className="tabbar" aria-label="Sections">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="tabbar__link">
            <Icon name={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <SessionExpiredDialog />
    </div>
  );
}
