import { useEffect, useMemo, useState } from 'react';
import { diplomasApi } from '../api/diplomas';
import { Button, ButtonLink } from '../components/Button';
import { DiplomaTable } from '../components/DiplomaTable';
import { EmptyState, ErrorNotice, Loading } from '../components/Feedback';
import { TextField, SelectField } from '../components/Field';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';
import type { DiplomaStatus } from '../types';

const PAGE_SIZE = 10;

export function DiplomaList() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  useSeo({ title: t('list.title'), description: t('list.description'), path: '/diplomas', noindex: true });

  const { data, error, loading, reload } = useAsync(() => diplomasApi.list(), []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | DiplomaStatus>('all');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [query, status]);

  const sorted = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((d) => {
      if (status !== 'all' && d.status !== status) return false;
      if (!q) return true;
      return [d.diplomaId, d.degree, d.major, d.institution].some((v) => v.toLowerCase().includes(q));
    });
  }, [sorted, query, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const revoked = sorted.filter((d) => d.status === 'REVOKED').length;

  return (
    <>
      <PageHeader
        title={hasRole('ministry') && !hasRole('university') ? t('list.title.audit') : t('list.title')}
        description={t('list.description')}
        actions={
          <>
            <Button variant="link" icon={<Icon name="refresh" />} onClick={reload} loading={loading && !!data}>
              {t('common.refresh')}
            </Button>
            {hasRole('university') && !!data && data.length > 0 && (
              <ButtonLink variant="primary" to="/issue">
                {t('nav.issue')}
              </ButtonLink>
            )}
          </>
        }
      />

      {loading && !data && <Loading />}
      {error !== undefined && !data && <ErrorNotice error={error} onRetry={reload} />}

      {data && (
        <>
          <p className="list-summary" aria-live="polite">
            {t('list.summary', { total: sorted.length, revoked })}
          </p>

          {sorted.length === 0 ? (
            <EmptyState
              title={t('list.empty.title')}
              action={
                hasRole('university') ? (
                  <ButtonLink variant="primary" to="/issue">
                    {t('nav.issue')}
                  </ButtonLink>
                ) : undefined
              }
            >
              {t('list.empty.text')}
            </EmptyState>
          ) : (
            <>
              <div className="toolbar" role="search">
                <TextField
                  id="q"
                  type="search"
                  label={t('list.search')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
                <SelectField id="status" label={t('table.status')} value={status} onChange={(e) => setStatus(e.target.value as 'all' | DiplomaStatus)}>
                  <option value="all">{t('list.filter.all')}</option>
                  <option value="VALID">{t('status.valid')}</option>
                  <option value="REVOKED">{t('status.revoked')}</option>
                </SelectField>
              </div>

              {filtered.length === 0 ? (
                <EmptyState title={t('list.noMatch.title')}>{t('list.noMatch.text')}</EmptyState>
              ) : (
                <>
                  <DiplomaTable records={visible} caption={t('list.title')} />
                  {pages > 1 && (
                    <nav className="pager" aria-label={t('list.pagination')}>
                      <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        {t('common.previous')}
                      </Button>
                      <span>{t('list.page', { page, pages })}</span>
                      <Button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>
                        {t('common.next')}
                      </Button>
                    </nav>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
