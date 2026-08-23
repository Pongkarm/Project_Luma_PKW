import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { isApiError } from '../../contracts/errors.ts';
import { useSession } from './sessionStore.ts';

export function SignInPage() {
  const signIn = useSession((state) => state.signIn);
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
          ? 'That username or password is not right.'
          : isApiError(cause)
            ? cause.message
            : 'Sign-in did not go through.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authpage">
      <form className="authcard" onSubmit={onSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
          <span className="brand__mark" style={{ width: 26, height: 26, fontSize: 14 }} aria-hidden="true">
            L
          </span>
          <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>Sign in to LUMA</h1>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <TextField
          label="Username or email"
          value={username}
          autoComplete="username"
          autoFocus
          required
          onChange={(event) => setUsername(event.target.value)}
        />

        <div style={{ position: 'relative' }}>
          <TextField
            label="Password"
            type={reveal ? 'text' : 'password'}
            value={password}
            autoComplete="current-password"
            required
            style={{ paddingRight: 34 }}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setReveal((value) => !value)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: 6,
              top: 25,
              width: 24,
              height: 24,
              border: 'none',
              background: 'none',
              color: 'var(--ink-3)',
              cursor: 'pointer',
            }}
          >
            <Icon name="eye" size={15} />
          </button>
        </div>

        <Button type="submit" variant="primary" block busy={busy} disabled={!username || !password}>
          Sign in
        </Button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
