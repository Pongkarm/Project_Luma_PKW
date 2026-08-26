import { useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui/Button.tsx';
import { TextField } from '../../shared/ui/Field.tsx';
import { PasswordField } from '../../shared/ui/PasswordField.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { useT, useLanguage } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { useSession } from '../auth/sessionStore.ts';
import { userService } from '../../services/userService.ts';
import { isApiError } from '../../contracts/errors.ts';
import { formatDateTime } from '../../shared/utils/format.ts';
import { passwordIsAcceptable, passwordRules } from '../auth/passwordRules.ts';

/**
 * Identity and the editing of it, in one place.
 *
 * These used to be split: the card showed a name and an email, and changing
 * either happened in a different card further down the page. Now the thing you
 * are looking at is the thing you edit.
 */
export function ProfileCard() {
  const t = useT();
  const language = useLanguage();
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const showToast = useToasts((state) => state.show);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [withPassword, setWithPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open() {
    setUsername(user?.username ?? '');
    setEmail(user?.email ?? '');
    setWithPassword(false);
    setNewPassword('');
    setConfirmNew('');
    setCurrentPassword('');
    setError(null);
    setEditing(true);
  }

  const changedName = username.trim() !== '' && username.trim() !== user?.username;
  const changedEmail = email.trim() !== '' && email.trim() !== user?.email;
  const pwMismatch = withPassword && confirmNew.length > 0 && confirmNew !== newPassword;
  const pwMatches = withPassword && confirmNew.length > 0 && confirmNew === newPassword;
  const changedPassword = withPassword && passwordIsAcceptable(newPassword) && pwMatches;
  const ready =
    currentPassword.length > 0 &&
    (changedName || changedEmail || changedPassword) &&
    (!withPassword || (passwordIsAcceptable(newPassword) && pwMatches));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Only send what actually changed, so an unchanged field cannot collide
      // with its own uniqueness check.
      const updated = await userService.update({
        current_password: currentPassword,
        ...(changedName ? { username: username.trim() } : {}),
        ...(changedEmail ? { email: email.trim() } : {}),
        ...(changedPassword ? { new_password: newPassword } : {}),
      });
      setUser(updated);
      showToast(t('account.saved'));
      setEditing(false);
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

  if (!editing) {
    return (
      <section className="card account__header">
        <span className="avatar avatar--lg" aria-hidden="true">
          {(user?.username ?? '?').slice(0, 1)}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', minWidth: 0 }}>
          <span className="account__name">{user?.username ?? '—'}</span>
          <span className="account__email">{user?.email ?? '—'}</span>
          <span className="account__email">
            {t('account.memberSince')} {user ? formatDateTime(user.created_at, language) : '—'}
          </span>
        </div>
        <div className="account__stat">
          <div className="account__statNum">{user?.total_generations ?? 0}</div>
          <div className="account__statLabel">{t('account.runs')}</div>
          <Button size="sm" icon="sliders" onClick={open} style={{ marginTop: 'var(--sp-8)' }}>
            {t('account.edit')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="card account__section">
      <span className="eyebrow">{t('account.edit')}</span>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-14)' }}>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <TextField
          label={t('account.newUsername')}
          value={username}
          autoComplete="username"
          autoFocus
          required
          hint={t('account.usernameNote')}
          onChange={(event) => setUsername(event.target.value)}
        />

        <TextField
          label={t('account.email')}
          type="email"
          value={email}
          autoComplete="email"
          required
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="label" style={{ cursor: 'pointer' }} htmlFor="with-password">
          <span>{t('account.changePasswordToo')}</span>
          <input
            id="with-password"
            type="checkbox"
            checked={withPassword}
            onChange={(event) => setWithPassword(event.target.checked)}
          />
        </label>

        {withPassword ? (
          <div className="field">
            <PasswordField
              label={t('account.newPassword')}
              value={newPassword}
              autoComplete="new-password"
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
              <span className={`auth__rule ${pwMatches ? 'auth__rule--met' : ''}`}>
                <Icon
                  name={pwMatches ? 'checkCircle' : 'queue'}
                  size={12}
                  className="auth__ruleIcon"
                  strokeDasharray={pwMatches ? undefined : '3 3'}
                />
                {t('auth.passwordMatches')}
              </span>
            </div>

            <div style={{ marginTop: 'var(--sp-14)' }}>
              <PasswordField
                label={t('auth.confirmPassword')}
                value={confirmNew}
                autoComplete="new-password"
                error={pwMismatch ? t('auth.passwordMismatch') : null}
                onChange={(event) => setConfirmNew(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {/* Not another editable value — the check that permits the edit. */}
        <div className="confirm-gate">
          <span className="confirm-gate__head">
            <Icon name="lock" size={15} className="confirm-gate__icon" />
            {t('account.confirmTitle')}
          </span>
          <PasswordField
            label={t('account.currentPassword')}
            value={currentPassword}
            autoComplete="current-password"
            required
            hint={t('account.confirmWhy')}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
          <Button type="button" onClick={() => setEditing(false)} disabled={busy}>
            {t('account.cancel')}
          </Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!ready}>
            {t('account.save')}
          </Button>
        </div>
      </form>
    </section>
  );
}
