import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { isApiError } from '../../contracts/errors.ts';
import { useSession } from './sessionStore.ts';
import { passwordIsAcceptable, passwordRules } from './passwordRules.ts';

export function RegisterPage() {
  const register = useSession((state) => state.register);
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = username.trim() !== '' && email.trim() !== '' && passwordIsAcceptable(password);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      navigate('/generate', { replace: true });
    } catch (cause) {
      if (isApiError(cause)) {
        // A clash comes back as a 400 naming neither field, so it is shown on both.
        if (cause.status === 400) {
          setError(cause.detail ?? 'That username or email is already taken.');
        } else if (cause.fieldErrors.length > 0) {
          setFieldError({ field: cause.fieldErrors[0].field, message: cause.fieldErrors[0].message });
        } else {
          setError(cause.message);
        }
      } else {
        setError('Creating the account did not go through.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authpage">
      <form className="authcard" onSubmit={onSubmit}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>Create your account</h1>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <TextField
          label="Username"
          value={username}
          autoComplete="username"
          autoFocus
          required
          error={fieldError?.field === 'username' ? fieldError.message : null}
          onChange={(event) => setUsername(event.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          autoComplete="email"
          required
          error={fieldError?.field === 'email' ? fieldError.message : null}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="field">
          <TextField
            label="Password"
            type="password"
            value={password}
            autoComplete="new-password"
            required
            onChange={(event) => setPassword(event.target.value)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: -2 }}>
            {passwordRules.map((rule) => {
              const met = rule.test(password);
              return (
                <span
                  key={rule.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: met ? 'var(--done)' : 'var(--ink-3)',
                  }}
                >
                  <Icon name={met ? 'checkCircle' : 'queue'} size={12} />
                  {rule.label}
                </span>
              );
            })}
          </div>
        </div>

        <Button type="submit" variant="primary" block busy={busy} disabled={!ready}>
          Create account
        </Button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          Already registered? <Link to="/signin">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
