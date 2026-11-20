import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      /* presse-papiers indisponible : l'utilisateur peut sélectionner le texte */
    }
  }

  return (
    <button type="button" className="btn btn--quiet btn--small" onClick={copy} aria-label={label ?? t('common.copy')}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      <span aria-live="polite">{copied ? t('common.copied') : t('common.copy')}</span>
    </button>
  );
}
