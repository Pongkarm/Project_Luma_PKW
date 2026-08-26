import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { Icon } from './Icon.tsx';

type FieldShellProps = {
  label: ReactNode;
  htmlFor: string;
  meta?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

function FieldShell({ label, htmlFor, meta, hint, error, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>{label}</span>
        {meta ? <span className="label__meta mono">{meta}</span> : null}
      </label>
      {children}
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

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: ReactNode;
  meta?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function TextField({ label, meta, hint, error, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} meta={meta} hint={hint} error={error}>
      <input
        id={id}
        className={['input', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: ReactNode;
  meta?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function TextAreaField({ label, meta, hint, error, className, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} meta={meta} hint={hint} error={error}>
      <textarea
        id={id}
        className={['textarea', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: ReactNode;
  meta?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

export function SelectField({ label, meta, hint, error, children, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} meta={meta} hint={hint} error={error}>
      <div className="select-wrap">
        <select id={id} className="select" {...rest}>
          {children}
        </select>
        <Icon name="chevronDown" size={14} className="select-wrap__chevron" />
      </div>
    </FieldShell>
  );
}
