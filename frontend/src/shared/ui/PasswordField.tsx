import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { useT } from '../hooks/useT.ts';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

/**
 * A password box with a reveal toggle.
 *
 * Built with its own markup rather than wrapping TextField: the toggle has to
 * sit on the input itself, and positioning it over a shared component meant
 * guessing offsets that broke whenever a hint appeared underneath or the field
 * height changed.
 */
export function PasswordField({ label, hint, error, className, ...rest }: Props) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const t = useT();

  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>{label}</span>
      </label>

      <div className="pw">
        <input
          id={id}
          type={reveal ? 'text' : 'password'}
          className={['input', 'pw__input', className ?? ''].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        <button
          type="button"
          className="pw__toggle"
          aria-label={reveal ? t('auth.hidePassword') : t('auth.showPassword')}
          title={reveal ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={reveal}
          onClick={() => setReveal((value) => !value)}
        >
          <Icon name={reveal ? 'eyeOff' : 'eye'} size={15} />
        </button>
      </div>

      {error ? (
        <span className="field__error" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
