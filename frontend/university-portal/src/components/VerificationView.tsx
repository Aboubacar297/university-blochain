import { useI18n } from '../i18n';
import type { VerificationResult } from '../types';
import { Attestation, Fields, type AttestationTone } from './Attestation';
import { Button } from './Button';
import { CopyButton } from './CopyButton';
import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';

/** Résultat d'une vérification : authentique, révoqué ou non conforme. */
export function VerificationView({ result, mode }: { result: VerificationResult; mode: 'document' | 'share' }) {
  const { t, date, dateTime } = useI18n();

  const revoked = result.status === 'REVOKED';
  const tone: AttestationTone = revoked ? 'revoked' : !result.hashMatches ? 'invalid' : 'valid';

  const status =
    tone === 'valid'
      ? mode === 'document'
        ? t('verify.valid.status')
        : t('verify.validShare.status')
      : tone === 'revoked'
        ? t('verify.revoked.status')
        : t('verify.invalid.status');

  const explanation =
    tone === 'valid'
      ? mode === 'document'
        ? t('verify.valid.text')
        : t('verify.validShare.text')
      : tone === 'revoked'
        ? t('verify.revoked.text', { date: result.revokedAt ? date(result.revokedAt) : '' })
        : t('verify.invalid.text');

  return (
    <div className="stack">
      <Attestation tone={tone} status={status} title={result.degree}>
        <p className="attestation__lead">{explanation}</p>
        <Fields
          items={[
            { label: t('field.major'), value: result.major || t('common.none') },
            { label: t('field.institution'), value: result.institution },
            { label: t('field.issueDate'), value: date(result.issueDate) },
            { label: t('field.status'), value: <StatusBadge status={result.status} /> },
            {
              label: t('field.reference'),
              value: (
                <span className="inline-copy">
                  <span className="is-data">{result.diplomaId}</span>
                  <CopyButton value={result.diplomaId} />
                </span>
              ),
            },
            { label: t('verify.checkedAt'), value: dateTime(result.checkedAt) },
          ]}
        />
      </Attestation>
      <div className="no-print">
        <Button icon={<Icon name="file" />} onClick={() => window.print()}>
          {t('verify.print')}
        </Button>
      </div>
    </div>
  );
}
