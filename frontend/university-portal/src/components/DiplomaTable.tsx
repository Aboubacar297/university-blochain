import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { shortId } from '../lib/format';
import type { Diploma } from '../types';
import { StatusBadge } from './StatusBadge';

export function DiplomaTable({ records, caption }: { records: Diploma[]; caption: string }) {
  const { t, date } = useI18n();
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.diploma')}</th>
            <th scope="col">{t('table.institution')}</th>
            <th scope="col">{t('table.issueDate')}</th>
            <th scope="col">{t('table.status')}</th>
            <th scope="col">{t('table.reference')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((d) => (
            <tr key={d.diplomaId}>
              <td data-label={t('table.diploma')}>
                <Link to={`/diplomas/${d.diplomaId}`} className="row-link">
                  {d.degree}
                </Link>
                {d.major && <span className="cell-sub">{d.major}</span>}
              </td>
              <td data-label={t('table.institution')}>{d.institution}</td>
              <td data-label={t('table.issueDate')}>{date(d.issueDate)}</td>
              <td data-label={t('table.status')}>
                <StatusBadge status={d.status} />
              </td>
              <td data-label={t('table.reference')} className="is-data">
                {shortId(d.diplomaId)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
