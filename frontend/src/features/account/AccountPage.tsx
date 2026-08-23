import { Button } from '../../shared/ui/Button.tsx';
import { Segmented } from '../../shared/ui/Segmented.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { usePreferences, type ThemeName } from '../../shared/stores/preferencesStore.ts';
import { formatDateTime } from '../../shared/utils/format.ts';
import { env } from '../../config/env.ts';

export function AccountPage() {
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);

  return (
    <main className="main">
      <div className="stagebar">
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>Account</span>
      </div>

      <div style={{ padding: 24, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow">Signed in as</span>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px 16px', fontSize: 13 }}>
              <span className="subtle">Username</span>
              <span>{user?.username ?? '—'}</span>
              <span className="subtle">Email</span>
              <span>{user?.email ?? '—'}</span>
              <span className="subtle">Runs</span>
              <span className="mono">{user?.total_generations ?? 0}</span>
              <span className="subtle">Member since</span>
              <span>{user ? formatDateTime(user.created_at) : '—'}</span>
            </div>
          </section>

          <div className="hairline" />

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow">Appearance</span>
            <Segmented<ThemeName>
              ariaLabel="Theme"
              options={[
                { value: 'dark', label: 'Dark', icon: 'moon' },
                { value: 'light', label: 'Light', icon: 'sun' },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </section>

          <div className="hairline" />

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow">Connection</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {env.apiBaseUrl}
            </span>
            <Alert tone="note">
              The API issues one access token and no refresh companion, and it has no logout route —
              so signing out discards the token on this device and nothing else.
            </Alert>
          </section>

          <div className="hairline" />

          <Button variant="danger" onClick={signOut} style={{ alignSelf: 'flex-start' }}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
