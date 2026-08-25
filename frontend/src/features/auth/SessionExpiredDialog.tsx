import { useState, type FormEvent } from 'react';
import { Dialog } from '../../shared/ui/Dialog.tsx';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { isApiError } from '../../contracts/errors.ts';
import { useSession } from './sessionStore.ts';
import { useT } from '../../shared/hooks/useT.ts';


/**
 * A 401 while someone is working raises this over the workspace instead of
 * throwing them back to a blank sign-in page. Their prompt, settings and
 * uploaded image are untouched — the API has no refresh token, so a long
 * session simply ends with a re-entry.
 */
export function SessionExpiredDialog() {
  const expired = useSession((state) => state.expired);
  const t = useT();
  const user = useSession((state) => state.user);
  const signIn = useSession((state) => state.signIn);
  const signOut = useSession((state) => state.signOut);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(user.username, password);
      setPassword('');
    } catch (cause) {
      setError(
        isApiError(cause) && cause.status === 401
          ? t('session.wrongPassword')
          : t('session.failed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={expired} title={t('session.title')}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Icon name="lock" size={18} />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t('session.title')}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            {t('session.body')}
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <TextField
          label={t('session.passwordFor', { name: user?.username ?? '' })}
          type="password"
          value={password}
          autoComplete="current-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" onClick={signOut} style={{ flex: 1 }}>
            {t('session.signOut')}
          </Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!password} style={{ flex: 1 }}>
            {t('session.continue')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
