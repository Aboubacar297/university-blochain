import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { diplomasApi } from '../api/diplomas';
import { ErrorNotice, Loading, Notice } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { VerificationView } from '../components/VerificationView';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';

export function PublicVerify() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  // Les liens de partage sont privés : jamais indexés
  useSeo({ title: t('public.title'), description: t('public.description'), path: '/v', noindex: true });
  const { data, error, loading, reload } = useAsync(() => diplomasApi.verifyShare(token), [token]);

  return (
    <>
      <PageHeader title={t('public.title')} description={t('public.description')} />
      {loading && !data && <Loading />}
      {error !== undefined &&
        !data &&
        (error instanceof ApiError && error.status === 401 ? (
          <Notice tone="warning" title={t('public.expired.title')}>
            {t('public.expired.text')}
          </Notice>
        ) : (
          <ErrorNotice error={error} onRetry={reload} />
        ))}
      {data && (
        <div className="stack">
          <VerificationView result={data} mode="share" />
          <Notice tone="info" title={t('public.document.title')}>
            {t('public.document.text')} <Link to="/verify">{t('verify.title')}</Link>
          </Notice>
        </div>
      )}
    </>
  );
}
