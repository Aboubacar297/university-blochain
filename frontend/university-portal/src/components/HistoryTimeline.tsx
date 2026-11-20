import { useI18n } from '../i18n';
import { shortHash } from '../lib/format';
import type { HistoryEntry } from '../types';

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const { t, dateTime } = useI18n();
  return (
    <ol className="timeline">
      {entries.map((entry, index) => {
        const revoked = entry.value?.status === 'REVOKED';
        const label = index === 0 ? t('history.issued') : revoked ? t('history.revoked') : t('history.updated');
        return (
          <li key={entry.txId} className={`timeline__item${revoked ? ' is-revoked' : ''}`}>
            <p className="timeline__label">{label}</p>
            <p className="timeline__meta">
              <time dateTime={entry.timestamp}>{dateTime(entry.timestamp)}</time>
            </p>
            {revoked && entry.value?.revokeReason && (
              <p className="timeline__reason">
                {t('detail.revokeReason')} : {entry.value.revokeReason}
              </p>
            )}
            <p className="timeline__tx">
              {t('history.transaction')} <span className="is-data">{shortHash(entry.txId)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
