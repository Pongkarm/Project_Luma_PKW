import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { isApiError } from '../../contracts/errors.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useSession } from './sessionStore.ts';
import { AuthLayout } from './AuthLayout.tsx';

export function SignInPage() {
  const signIn = useSession((state) => state.signIn);
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from ?? '/generate';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
      navigate(returnTo, { replace: true });
    } catch (cause) {
      // A 401 here means the credentials are wrong, not that a session ended.
      setError(
        isApiError(cause) && cause.status === 401
          ? t('auth.wrongCredentials')
          : isApiError(cause)
            ? cause.message
            : t('auth.signInFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.signIn')} subtitle={t('auth.signInSub')}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error ? (
          <div className="auth__error">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <TextField
          label={t('auth.usernameOrEmail')}
          value={username}
          autoComplete="username"
          autoFocus
          required
          onChange={(event) => setUsername(event.target.value)}
        />

        <div style={{ position: 'relative' }}>
          <TextField
            label={t('auth.password')}
            type={reveal ? 'text' : 'password'}
            value={password}
            autoComplete="current-password"
            required
            style={{ paddingRight: 34 }}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="auth__reveal"
            onClick={() => setReveal((value) => !value)}
            aria-label={reveal ? t('auth.hidePassword') : t('auth.showPassword')}
          >
            <Icon name="eye" size={15} />
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          block
          busy={busy}
          disabled={!username || !password}
          style={{ marginTop: 2 }}
        >
          {t('auth.signIn')}
        </Button>
      </form>

      <div className="auth__divider" />

      <p className="auth__alt">
        {t('auth.noAccount')} <Link to="/register">{t('auth.createOne')}</Link>
      </p>
    </AuthLayout>
  );
}
