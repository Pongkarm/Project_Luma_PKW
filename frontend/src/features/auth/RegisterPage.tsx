import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { PasswordField } from '../../shared/ui/PasswordField.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { isApiError } from '../../contracts/errors.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useSession } from './sessionStore.ts';
import { passwordIsAcceptable, passwordRules } from './passwordRules.ts';
import { AuthLayout } from './AuthLayout.tsx';

export function RegisterPage() {
  const register = useSession((state) => state.register);
  const t = useT();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Only complain once they have started the second box — flagging a mismatch
  // against an empty field would call every password wrong as it is typed.
  const mismatch = confirm.length > 0 && confirm !== password;
  const matches = confirm.length > 0 && confirm === password;
  const ready =
    username.trim() !== '' &&
    email.trim() !== '' &&
    passwordIsAcceptable(password) &&
    matches;

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
        // A clash comes back as a 400 naming neither field, so it is shown above both.
        if (cause.status === 400) {
          setError(cause.detail ?? t('auth.taken'));
        } else if (cause.fieldErrors.length > 0) {
          setFieldError({ field: cause.fieldErrors[0].field, message: cause.fieldErrors[0].message });
        } else {
          setError(cause.message);
        }
      } else {
        setError(t('auth.registerFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.createTitle')} subtitle={t('auth.createSub')}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error ? (
          <div className="auth__error">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <TextField
          label={t('auth.username')}
          value={username}
          autoComplete="username"
          autoFocus
          required
          error={fieldError?.field === 'username' ? fieldError.message : null}
          onChange={(event) => setUsername(event.target.value)}
        />

        <TextField
          label={t('auth.email')}
          type="email"
          value={email}
          autoComplete="email"
          required
          error={fieldError?.field === 'email' ? fieldError.message : null}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div>
          <PasswordField
            label={t('auth.password')}
            value={password}
            autoComplete="new-password"
            required
            onChange={(event) => setPassword(event.target.value)}
          />

          <div className="auth__rules">
            {passwordRules.map((rule) => {
              const met = rule.test(password);
              return (
                <span
                  key={rule.id}
                  className={`auth__rule ${met ? 'auth__rule--met' : ''}`}
                >
                  <Icon
                    name={met ? 'checkCircle' : 'queue'}
                    size={12}
                    className="auth__ruleIcon"
                    strokeDasharray={met ? undefined : '3 3'}
                  />
                  {t(rule.labelKey)}
                </span>
              );
            })}
            <span className={`auth__rule ${matches ? 'auth__rule--met' : ''}`}>
              <Icon
                name={matches ? 'checkCircle' : 'queue'}
                size={12}
                className="auth__ruleIcon"
                strokeDasharray={matches ? undefined : '3 3'}
              />
              {t('auth.passwordMatches')}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <PasswordField
              label={t('auth.confirmPassword')}
              value={confirm}
              autoComplete="new-password"
              required
              error={mismatch ? t('auth.passwordMismatch') : null}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          block
          busy={busy}
          disabled={!ready}
          style={{ marginTop: 2 }}
        >
          {t('auth.createAccount')}
        </Button>
      </form>

      <div className="auth__divider" />

      <p className="auth__alt">
        {t('auth.already')} <Link to="/signin">{t('auth.signIn')}</Link>
      </p>
    </AuthLayout>
  );
}
