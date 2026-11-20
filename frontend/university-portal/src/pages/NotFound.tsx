import { ButtonLink } from '../components/Button';
import { useI18n } from '../i18n';
import { useSeo } from '../lib/useSeo';

export function NotFound() {
  const { t } = useI18n();
  useSeo({ title: t('notfound.title'), description: t('notfound.text'), path: '/404', noindex: true });
  return (
    <div className="notfound">
      <p className="notfound__code" aria-hidden="true">
        404
      </p>
      <h1>{t('notfound.title')}</h1>
      <p>{t('notfound.text')}</p>
      <div className="actions spaced">
        <ButtonLink variant="primary" to="/">
          {t('common.backHome')}
        </ButtonLink>
      </div>
    </div>
  );
}
