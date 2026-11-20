import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n';
import type { Role } from '../types';
import { ButtonLink } from './Button';
import { Loading, Notice } from './Feedback';
import { PageHeader } from './PageHeader';

export function AccessDenied() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('denied.title')} />
      <Notice tone="warning" title={t('denied.heading')}>
        {t('denied.text')}
      </Notice>
      <p className="spaced">
        <ButtonLink variant="primary" to="/">
          {t('common.backHome')}
        </ButtonLink>
      </p>
    </>
  );
}

/** Protège une page : redirige vers Keycloak si nécessaire, refuse l'accès si le rôle manque. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { ready, authenticated, unavailable, hasRole, login } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (ready && !authenticated && !unavailable) login();
  }, [ready, authenticated, unavailable, login]);

  if (!ready) return <Loading />;
  if (!authenticated) {
    return unavailable ? (
      <Notice tone="danger" title={t('auth.unavailable.title')}>
        {t('auth.unavailable.text')}
      </Notice>
    ) : (
      <Loading label={t('auth.redirecting')} />
    );
  }
  if (!hasRole(...roles)) return <AccessDenied />;
  return <>{children}</>;
}
