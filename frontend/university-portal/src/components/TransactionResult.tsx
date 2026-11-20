import { config } from '../config';
import { useI18n } from '../i18n';
import type { TransactionVerification } from '../types';
import { Attestation, Fields, type AttestationTone } from './Attestation';
import { CopyButton } from './CopyButton';
import { QrCode } from './QrCode';
import { StatusBadge } from './StatusBadge';

/** Résultat de la vérification instantanée d'une transaction du registre. */
export function TransactionResult({ result }: { result: TransactionVerification }) {
  const { t, date, dateTime } = useI18n();
  const tone: AttestationTone = result.valid ? 'valid' : 'revoked';
  const status = result.valid
    ? t('tx.valid.status')
    : result.txType === 'REVOKED'
      ? t('tx.revokedTx.status')
      : t('tx.revoked.status');
  const explanation = result.valid
    ? t('tx.valid.text')
    : result.txType === 'REVOKED'
      ? t('tx.revokedTx.text')
      : t('tx.revoked.text', { date: result.revokedAt ? date(result.revokedAt) : '' });

  return (
    <Attestation tone={tone} status={status} title={result.degree}>
      <p className="attestation__lead">{explanation}</p>
      <div className="preview">
        <Fields
          items={[
            { label: t('field.major'), value: result.major || t('common.none') },
            { label: t('field.institution'), value: result.institution },
            { label: t('field.issueDate'), value: date(result.issueDate) },
            { label: t('field.status'), value: <StatusBadge status={result.status} /> },
            { label: t('tx.type'), value: result.txType === 'ISSUED' ? t('tx.type.issued') : t('tx.type.revoked') },
            { label: t('tx.timestamp'), value: dateTime(result.txTimestamp) },
            {
              label: t('tx.id'),
              value: (
                <span className="inline-copy">
                  <span className="is-data">{result.txId}</span>
                  <CopyButton value={result.txId} />
                </span>
              ),
            },
            { label: t('verify.checkedAt'), value: dateTime(result.checkedAt) },
          ]}
        />
        <QrCode value={`${config.siteUrl}/verify?tx=${result.txId}`} label={t('tx.qr.alt')} />
      </div>
    </Attestation>
  );
}
