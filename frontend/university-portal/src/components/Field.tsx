import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function Shell({ id, label, hint, error, required, children }: FieldShellProps & { children: (a: { describedBy?: string; invalid?: true }) => ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="field__req" aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {children({ describedBy, invalid: error ? true : undefined })}
      {error && (
        <p id={errorId} className="field__error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function TextField({ id, label, hint, error, required, ...input }: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} aria-required={required || undefined} {...input} />
      )}
    </Shell>
  );
}

export function TextArea({ id, label, hint, error, required, ...input }: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} aria-required={required || undefined} {...input} />
      )}
    </Shell>
  );
}

export function SelectField({ id, label, hint, error, required, children, ...input }: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} aria-required={required || undefined} {...input}>
          {children}
        </select>
      )}
    </Shell>
  );
}
