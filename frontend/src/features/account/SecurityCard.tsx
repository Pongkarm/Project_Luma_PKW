import { useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { userService } from '../../services/userService.ts';
import { isApiError } from '../../contracts/errors.ts';
import { passwordIsAcceptable, passwordRules } from '../auth/passwordRules.ts';

type Mode = null | 'email' | 'password';

/**
 * Changing an email or a password. Both go through the same form because both
 * need the current password — the API requires it for either, so that a stolen
 * token cannot be used to lock the owner out of their own account.
 */
export function SecurityCard() {
  const t = useT();
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const showToast = useToasts((state) => state.show);

  const [mode, setMode] = useState<Mode>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setMode(null);
    setCurrentPassword('');
    setEmail('');
    setNewPassword('');
    setError(null);
  }

  const ready =
    currentPassword.length > 0 &&
    (mode === 'email' ? email.trim().length > 0 : passwordIsAcceptable(newPassword));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await userService.update({
        current_password: currentPassword,
        ...(mode === 'email' ? { email: email.trim() } : { new_password: newPassword }),
      });
      setUser(updated);
      showToast(t(mode === 'email' ? 'account.emailSaved' : 'account.passwordSaved'));
      close();
    } catch (cause) {
      setError(
        isApiError(cause) && cause.status === 401
          ? t('account.wrongPassword')
          : isApiError(cause)
            ? (cause.detail ?? cause.message)
            : t('account.updateFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card account__section">
      <span className="eyebrow">{t('account.security')}</span>

      {mode === null ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              icon="user"
              onClick={() => {
                setMode('email');
                setEmail(user?.email ?? '');
              }}
            >
              {t('account.changeEmail')}
            </Button>
            <Button icon="lock" onClick={() => setMode('password')}>
              {t('account.changePassword')}
            </Button>
          </div>
          <span className="field__hint">{t('account.confirmNote')}</span>
        </>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error ? <Alert tone="error">{error}</Alert> : null}

          {mode === 'email' ? (
            <TextField
              label={t('account.newEmail')}
              type="email"
              value={email}
              autoComplete="email"
              autoFocus
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          ) : (
            <div className="field">
              <TextField
                label={t('account.newPassword')}
                type="password"
                value={newPassword}
                autoComplete="new-password"
                autoFocus
                required
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <div className="auth__rules">
                {passwordRules.map((rule) => {
                  const met = rule.test(newPassword);
                  return (
                    <span key={rule.id} className={`auth__rule ${met ? 'auth__rule--met' : ''}`}>
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
              </div>
            </div>
          )}

          <TextField
            label={t('account.currentPassword')}
            type="password"
            value={currentPassword}
            autoComplete="current-password"
            required
            hint={t('account.tokenStays')}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" onClick={close} disabled={busy}>
              {t('account.cancel')}
            </Button>
            <Button type="submit" variant="primary" busy={busy} disabled={!ready}>
              {t('account.save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
