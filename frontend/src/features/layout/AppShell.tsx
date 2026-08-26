import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../shared/ui/Icon.tsx';
import { IconButton } from '../../shared/ui/Button.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { usePreferences } from '../../shared/stores/preferencesStore.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { AiModeBadge, EnginePill } from './EngineIndicator.tsx';
import { SessionExpiredDialog } from '../auth/SessionExpiredDialog.tsx';
import { Toasts } from '../../shared/ui/Toast.tsx';
import { usePresets } from '../generate/presetStore.ts';
import { useDraft } from '../generate/draftStore.ts';

type NavItem = { to: string; label: string; icon: IconName; count?: number; minor?: boolean };

export function AppShell() {
  const user = useSession((state) => state.user);
  const theme = usePreferences((state) => state.theme);
  const toggleTheme = usePreferences((state) => state.toggleTheme);
  const language = usePreferences((state) => state.language);
  const setLanguage = usePreferences((state) => state.setLanguage);
  const t = useT();
  const navigate = useNavigate();
  const railCollapsed = usePreferences((state) => state.railCollapsed);
  const toggleRail = usePreferences((state) => state.toggleRail);
  const presets = usePresets((state) => state.presets);
  const applyDraft = useDraft((state) => state.patch);

  const items: NavItem[] = [
    { to: '/generate', label: t('nav.generate'), icon: 'generate' },
    { to: '/history', label: t('nav.history'), icon: 'clock', count: user?.total_generations },
    { to: '/account', label: t('nav.account'), icon: 'user', minor: true },
  ];

  const [primary, ...rest] = items;

  function renderLink(item: NavItem, primaryStyle = false) {
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={[
          'rail__link',
          primaryStyle ? 'rail__link--primary' : '',
          item.minor ? 'rail__link--minor' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-label={item.label}
        title={item.label}
      >
        <Icon name={item.icon} size={16} />
        <span className="rail__label">{item.label}</span>
        {item.count !== undefined ? <span className="rail__count">{item.count}</span> : null}
      </NavLink>
    );
  }

  return (
    <div className="app">
      <a className="skip" href="#main">
        {t('nav.skip')}
      </a>
      <header className="topbar">
        <NavLink to="/generate" className="brand">
          <span className="brand__mark" aria-hidden="true">
            L
          </span>
          <span className="brand__word">LUMA</span>
        </NavLink>

        <div className="topbar__cluster">
          <EnginePill />
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
              gap: 'var(--sp-8)',
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
        <nav className="rail" aria-label={t('nav.sections')} data-collapsed={railCollapsed}>
          <div className="rail__section">{renderLink(primary, true)}</div>

          <div className="rail__section">
            <span className="rail__sectionLabel">{t('nav.library')}</span>
            {rest.filter((item) => !item.minor).map((item) => renderLink(item))}

            {/* Saved settings apply straight from here — they were otherwise
                only reachable after opening Advanced. */}
            {presets.slice(0, 4).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rail__preset"
                title={t('nav.applyPreset', { name: preset.name })}
                onClick={() => {
                  applyDraft({
                    width: preset.width,
                    height: preset.height,
                    steps: preset.steps,
                    cfgScale: preset.cfgScale,
                    samplerName: preset.samplerName,
                    modelName: preset.modelName,
                    loraId: preset.loraId,
                    negativePrompt: preset.negativePrompt,
                  });
                  navigate('/generate');
                }}
              >
                <Icon name="sliders" size={13} />
                {preset.name}
              </button>
            ))}
          </div>

          <div className="rail__spacer" />

          <div className="rail__section">{rest.filter((item) => item.minor).map((item) => renderLink(item))}</div>

          <button
            type="button"
            className="rail__collapse"
            aria-label={railCollapsed ? t('nav.expand') : t('nav.collapse')}
            title={railCollapsed ? t('nav.expand') : t('nav.collapse')}
            onClick={toggleRail}
          >
            <Icon name={railCollapsed ? 'chevronRight' : 'chevronLeft'} size={13} />
          </button>
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
