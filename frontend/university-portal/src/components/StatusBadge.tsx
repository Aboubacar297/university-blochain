import { useI18n } from '../i18n';
import type { DiplomaStatus } from '../types';
import { Icon } from './Icon';

/** Le statut est exprimé par le texte et l'icône, pas uniquement par la couleur (WCAG 1.4.1). */
export function StatusBadge({ status }: { status: DiplomaStatus }) {
  const { t } = useI18n();
  const valid = status === 'VALID';
  return (
    <span className={`badge badge--${valid ? 'ok' : 'bad'}`}>
      <Icon name={valid ? 'check' : 'x'} size={14} />
      {valid ? t('status.valid') : t('status.revoked')}
    </span>
  );
}
