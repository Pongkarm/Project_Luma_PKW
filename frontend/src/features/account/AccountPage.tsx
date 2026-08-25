import { Button } from '../../shared/ui/Button.tsx';
import { Segmented } from '../../shared/ui/Segmented.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { usePreferences, type ThemeName } from '../../shared/stores/preferencesStore.ts';
import { formatDateTime } from '../../shared/utils/format.ts';
import { env } from '../../config/env.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { languages, type Language } from '../../config/i18n.ts';

export function AccountPage() {
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const theme = usePreferences((state) => state.theme);
  const language = usePreferences((state) => state.language);
  const setLanguage = usePreferences((state) => state.setLanguage);
  const t = useT();
  const setTheme = usePreferences((state) => state.setTheme);

  return (
    <main className="main">
      <div className="stagebar">
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t('account.title')}</span>
      </div>

      <div style={{ padding: 24, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow">{t('account.signedInAs')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px 16px', fontSize: 'var(--fs-sm)' }}>
              <span className="subtle">{t('account.username')}</span>
              <span>{user?.username ?? '—'}</span>
              <span className="subtle">{t('account.email')}</span>
              <span>{user?.email ?? '—'}</span>
              <span className="subtle">{t('account.runs')}</span>
              <span className="mono">{user?.total_generations ?? 0}</span>
              <span className="subtle">{t('account.memberSince')}</span>
              <span>{user ? formatDateTime(user.created_at) : '—'}</span>
            </div>
          </section>

          <div className="hairline" />

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          </section>

          <div className="hairline" />

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow">{t('account.language')}</span>
            <Segmented<Language>
              ariaLabel={t('account.language')}
              options={languages.map((entry) => ({ value: entry.value, label: entry.label }))}
              value={language}
              onChange={setLanguage}
            />
          </section>

          <div className="hairline" />

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow">{t('account.connection')}</span>
            <span className="mono" style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
              {env.apiBaseUrl}
            </span>
            <Alert tone="note">
              {t('account.tokenNote')}
            </Alert>
          </section>

          <div className="hairline" />

          <Button variant="danger" onClick={signOut} style={{ alignSelf: 'flex-start' }}>
            {t('account.signOut')}
          </Button>
        </div>
      </div>
    </main>
  );
}
