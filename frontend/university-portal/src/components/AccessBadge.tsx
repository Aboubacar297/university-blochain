import { useEffect, useState } from 'react';
import { accessApi } from '../api/diplomas';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { Icon } from './Icon';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Compte à rebours de l'accès étudiant : « Accès actif : expire dans X jours ». */
export function AccessBadge() {
  const { t } = useI18n();
  const { data } = useAsync(() => accessApi.me(), []);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!data || !data.managed || !data.expiresAt) return null;
  const left = new Date(data.expiresAt).getTime() - now;

  if (data.status === 'EXPIRED' || left <= 0) {
    return (
      <p className="access-badge access-badge--expired" role="status">
        <Icon name="lock" />
        <span>{t('access.badge.expired')}</span>
      </p>
    );
  }

  const days = Math.ceil(left / DAY);
  const text =
    left < DAY
      ? t('access.badge.hours', { hours: Math.max(1, Math.ceil(left / HOUR)) })
      : days === 1
        ? t('access.badge.oneDay')
        : t('access.badge.days', { days });

  return (
    <p className={`access-badge${days <= 7 ? ' access-badge--warn' : ''}`} role="status">
      <Icon name="calendar" />
      <span>{text}</span>
    </p>
  );
}
