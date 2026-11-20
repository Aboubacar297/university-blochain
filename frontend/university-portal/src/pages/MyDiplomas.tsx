import { diplomasApi } from '../api/diplomas';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { DiplomaTable } from '../components/DiplomaTable';
import { EmptyState, ErrorNotice, Loading, Notice } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { config } from '../config';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';
import { AccessBadge } from '../components/AccessBadge';

export function MyDiplomas() {
  const { t } = useI18n();
  const { user } = useAuth();
  useSeo({ title: t('mine.title'), description: t('mine.description'), path: '/my-diplomas', noindex: true });
  const { data, error, loading, reload } = useAsync(() => diplomasApi.mine(), []);

  return (
    <>
      <PageHeader
        title={t('mine.title')}
        description={t('mine.description')}
        actions={
          <Button variant="link" icon={<Icon name="refresh" />} onClick={reload} loading={loading && !!data}>
            {t('common.refresh')}
          </Button>
        }
      />

      <div className="access-slot">
        <AccessBadge />
      </div>

      {user && !user.studentId && (
        <Notice tone="warning" title={t('mine.noStudentId.title')}>
          {t('mine.noStudentId.text')}
        </Notice>
      )}

      {loading && !data && <Loading />}
      {error !== undefined && !data && <ErrorNotice error={error} onRetry={reload} />}

      {data &&
        (data.length === 0 ? (
          <EmptyState title={t('mine.empty.title')}>{t('mine.empty.text', { institution: config.institution })}</EmptyState>
        ) : (
          <>
            <p className="list-summary">{t('mine.hint')}</p>
            <DiplomaTable records={data} caption={t('mine.title')} />
          </>
        ))}
    </>
  );
}
