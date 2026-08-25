import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from '../../shared/ui/Icon.tsx';
import { IconButton } from '../../shared/ui/Button.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { usePreferences } from '../../shared/stores/preferencesStore.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { AiModeBadge, EngineIndicator } from './EngineIndicator.tsx';
import { SessionExpiredDialog } from '../auth/SessionExpiredDialog.tsx';
import { Toasts } from '../../shared/ui/Toast.tsx';

type NavItem = { to: string; label: string; icon: IconName; count?: number; minor?: boolean };

export function AppShell() {
  const user = useSession((state) => state.user);
  const theme = usePreferences((state) => state.theme);
  const toggleTheme = usePreferences((state) => state.toggleTheme);
  const language = usePreferences((state) => state.language);
  const setLanguage = usePreferences((state) => state.setLanguage);
  const t = useT();

  const items: NavItem[] = [
    { to: '/generate', label: t('nav.generate'), icon: 'generate' },
    { to: '/history', label: t('nav.history'), icon: 'clock', count: user?.total_generations },
    { to: '/account', label: t('nav.account'), icon: 'user', minor: true },
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
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            style={{ border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' }}
            aria-label={language === 'en' ? t('top.toThai') : t('top.toEnglish')}
            title={language === 'en' ? t('top.toThai') : t('top.toEnglish')}
            onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
          >
            {language === 'en' ? 'EN' : 'ไทย'}
          </button>
          <IconButton
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label={theme === 'dark' ? t('top.toLight') : t('top.toDark')}
            onClick={toggleTheme}
          />
          <NavLink
            to="/account"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--ink-2)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Icon name="user" size={15} />
            {user?.username ?? t('nav.account')}
            {user ? (
              <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
                {user.total_generations}
              </span>
            ) : null}
          </NavLink>
        </div>
      </header>

      <div className="app__body">
        <nav className="rail" aria-label={t('nav.sections')}>
          <div className="rail__nav">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`rail__link${item.minor ? ' rail__link--minor' : ''}`}
                data-label={item.label}
                title={item.label}
              >
                <Icon name={item.icon} size={16} />
                <span className="rail__label">{item.label}</span>
                {item.count !== undefined ? <span className="rail__count">{item.count}</span> : null}
              </NavLink>
            ))}
          </div>
          <div className="rail__foot">
            <span className="eyebrow">{t('nav.engine')}</span>
            <EngineIndicator />
          </div>
        </nav>

        <Outlet />
      </div>

      <nav className="tabbar" aria-label={t('nav.sections')}>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="tabbar__link">
            <Icon name={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <SessionExpiredDialog />
      <Toasts />
    </div>
  );
}
