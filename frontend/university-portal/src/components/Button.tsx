import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/**
 * Une seule action principale (`primary`, or champagne) par vue.
 * Les actions secondaires utilisent `link` (texte souligné) et la suppression `dangerlink`.
 * `danger` (rouge plein) n'existe que dans une boîte de dialogue de confirmation.
 * `neutral` est réservé au bandeau de consentement (accepter et refuser à égalité).
 */
type Variant = 'primary' | 'link' | 'danger' | 'dangerlink' | 'neutral' | 'secondary' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'link', loading = false, icon, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner spinner--inline" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  icon?: ReactNode;
}

export function ButtonLink({ variant = 'link', icon, children, className = '', ...rest }: ButtonLinkProps) {
  return (
    <Link className={`btn btn--${variant} ${className}`.trim()} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
