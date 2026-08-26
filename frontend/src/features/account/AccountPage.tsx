import { Button } from '../../shared/ui/Button.tsx';
import { Segmented } from '../../shared/ui/Segmented.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { usePreferences, type ThemeName } from '../../shared/stores/preferencesStore.ts';
import { env } from '../../config/env.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { usePageTitle } from '../../shared/hooks/usePageTitle.ts';
import { languages, type Language } from '../../config/i18n.ts';
import { ProfileCard } from './ProfileCard.tsx';

export function AccountPage() {
  const t = useT();
  usePageTitle(t('account.title'));
  const signOut = useSession((state) => state.signOut);
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);
  const language = usePreferences((state) => state.language);
  const setLanguage = usePreferences((state) => state.setLanguage);

  return (
    <main className="main" id="main" tabIndex={-1}>
      <div className="stagebar">
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t('account.title')}</span>
      </div>

      <div style={{ padding: 'var(--sp-24)', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div className="account">
          <ProfileCard />

          <section className="card account__section">
            <span className="eyebrow">{t('account.appearance')}</span>
            <Segmented<ThemeName>
              ariaLabel={t('account.theme')}
              options={[
                { value: 'dark', label: t('account.dark'), icon: 'moon' },
                { value: 'light', label: t('account.light'), icon: 'sun' },
              ]}
              value={theme}
              onChange={setTheme}
            />
            <Segmented<Language>
              ariaLabel={t('account.language')}
              options={languages.map((entry) => ({ value: entry.value, label: entry.label }))}
              value={language}
              onChange={setLanguage}
            />
          </section>

          <section className="card account__section">
            <span className="eyebrow">{t('account.connection')}</span>
            <span className="mono" style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
              {env.apiBaseUrl}
            </span>
            <Alert tone="note">{t('account.tokenNote')}</Alert>
          </section>

          <section className="card account__section">
            <Button variant="danger" icon="lock" onClick={signOut} style={{ alignSelf: 'flex-start' }}>
              {t('account.signOut')}
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}
