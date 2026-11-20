import { useId, type ReactNode } from 'react';
import { Icon } from './Icon';

export type AttestationTone = 'valid' | 'revoked' | 'invalid' | 'neutral';

interface AttestationProps {
  tone?: AttestationTone;
  status?: string;
  title: string;
  children: ReactNode;
}

/**
 * Fiche d'enregistrement : présente un diplôme ou un résultat de vérification
 * comme un extrait de registre officiel (double filet, statut en tête).
 */
export function Attestation({ tone = 'neutral', status, title, children }: AttestationProps) {
  const titleId = useId();
  const icon = tone === 'valid' ? 'check' : tone === 'neutral' ? 'file' : 'x';
  return (
    <section className={`attestation attestation--${tone}`} aria-labelledby={titleId}>
      <div className="attestation__inner">
        {status && (
          <p className="attestation__status" role="status">
            <Icon name={icon} size={20} />
            <span>{status}</span>
          </p>
        )}
        <h2 id={titleId} className="attestation__title">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export interface FieldItem {
  label: string;
  value: ReactNode;
  data?: boolean;
}

export function Fields({ items }: { items: FieldItem[] }) {
  return (
    <dl className="fields">
      {items.map((item) => (
        <div className="fields__row" key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.data ? 'is-data' : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
