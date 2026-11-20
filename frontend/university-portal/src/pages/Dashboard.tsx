import { useMemo } from 'react';
import { statsApi } from '../api/diplomas';
import { ButtonLink } from '../components/Button';
import { AreaChart, type ChartPoint, type ChartSeries } from '../components/AreaChart';
import { ErrorNotice, Loading, Notice } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';

/** Tableau de bord du Ministère : indicateurs du registre et courbes des 12 derniers mois. */
export function Dashboard() {
  const { t, lang, dateTime } = useI18n();
  useSeo({ title: t('dashboard.title'), description: t('dashboard.description'), path: '/dashboard', noindex: true });
  const { data, error, loading, reload } = useAsync(() => statsApi.get(), []);

  const series = useMemo<ChartSeries[]>(
    () => [
      { key: 'issued', label: t('dashboard.series.issued'), color: '#10B981' },
      { key: 'verifications', label: t('dashboard.series.verifications'), color: '#D4B46A' },
      { key: 'revoked', label: t('dashboard.series.revoked'), color: '#F28B82' },
    ],
    [t],
  );

  const points = useMemo<ChartPoint[]>(() => {
    if (!data) return [];
    const locale = lang === 'fr' ? 'fr-MA' : 'en-GB';
    const long = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const short = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    return data.months.map((m) => {
      const d = new Date(`${m.month}-01T00:00:00Z`);
      return {
        label: long.format(d),
        shortLabel: short.format(d).replace('.', ''),
        values: { issued: m.issued, revoked: m.revoked, verifications: m.verifications },
      };
    });
  }, [data, lang]);

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        actions={
          <ButtonLink variant="primary" to="/diplomas">
            {t('dashboard.openRegistry')}
          </ButtonLink>
        }
      />

      {loading && !data && <Loading />}
      {error !== undefined && !data && <ErrorNotice error={error} onRetry={reload} />}

      {data && (
        <div className="stack">
          <div className="kpis">
            <div className="kpi">
              <span className="kpi__value">{data.totals.issued}</span>
              <span className="kpi__label">{t('dashboard.kpi.issued')}</span>
            </div>
            <div className="kpi kpi--ok">
              <span className="kpi__value">{data.totals.valid}</span>
              <span className="kpi__label">{t('dashboard.kpi.valid')}</span>
            </div>
            <div className="kpi kpi--bad">
              <span className="kpi__value">{data.totals.revoked}</span>
              <span className="kpi__label">{t('dashboard.kpi.revoked')}</span>
            </div>
            <div className="kpi">
              <span className="kpi__value">{data.totals.verifications}</span>
              <span className="kpi__label">{t('dashboard.kpi.verifications')}</span>
            </div>
          </div>

          <section className="card" aria-labelledby="chart-title">
            <h2 id="chart-title">{t('dashboard.chart.title')}</h2>
            <p className="muted">{t('dashboard.chart.subtitle')}</p>
            <AreaChart points={points} series={series} ariaLabel={t('dashboard.chart.title')} tableCaption={t('dashboard.chart.tableCaption')} />
          </section>

          <Notice tone="info" title={t('dashboard.standards.title')}>
            {t('dashboard.standards.text')}
          </Notice>

          <p className="muted">{t('dashboard.updated', { date: dateTime(data.generatedAt) })}</p>
        </div>
      )}
    </>
  );
}
