import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Notice } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { config } from '../config';
import { useI18n } from '../i18n';
import { useSeo } from '../lib/useSeo';

const UPDATED = '2026-11-15';

function LegalPage({
  title,
  description,
  path,
  sections,
}: {
  title: string;
  description: string;
  path: string;
  sections: Array<{ id: string; heading: string; body: ReactNode }>;
}) {
  const { t, date } = useI18n();
  useSeo({ title, description, path });

  return (
    <div className="legal">
      <PageHeader title={title} description={description} />
      {config.legalDraft && (
        <Notice tone="warning" title={t('legal.draft.title')}>
          {t('legal.draft.text')}
        </Notice>
      )}
      <p className="legal__updated">{t('legal.updated', { date: date(UPDATED) })}</p>

      <nav className="legal__toc" aria-labelledby="toc-title">
        <h2 id="toc-title">{t('legal.toc')}</h2>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.heading}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`}>
          <h2 id={`${s.id}-title`}>{s.heading}</h2>
          {s.body}
        </section>
      ))}
    </div>
  );
}

/** Politique de confidentialité : adaptée aux données universitaires et à l'immuabilité de la blockchain. */
export function Privacy() {
  const { t } = useI18n();
  const mail = (
    <a href={`mailto:${config.privacyEmail}`}>{config.privacyEmail}</a>
  );

  return (
    <LegalPage
      title={t('privacy.title')}
      description={t('seo.privacy.description')}
      path="/privacy"
      sections={[
        {
          id: 'controller',
          heading: t('privacy.controller.title'),
          body: (
            <>
              <p>{t('privacy.controller.p1', { institution: config.institution })}</p>
              <p>
                {t('privacy.controller.p2')} {mail}
              </p>
            </>
          ),
        },
        {
          id: 'data',
          heading: t('privacy.data.title'),
          body: (
            <>
              <p>{t('privacy.data.intro')}</p>
              <ul>
                <li>
                  <strong>{t('privacy.data.identity.label')}</strong> {t('privacy.data.identity.text')}
                </li>
                <li>
                  <strong>{t('privacy.data.diploma.label')}</strong> {t('privacy.data.diploma.text')}
                </li>
                <li>
                  <strong>{t('privacy.data.document.label')}</strong> {t('privacy.data.document.text')}
                </li>
                <li>
                  <strong>{t('privacy.data.technical.label')}</strong> {t('privacy.data.technical.text')}
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'blockchain',
          heading: t('privacy.chain.title'),
          body: (
            <>
              <p>{t('privacy.chain.p1')}</p>
              <ul>
                <li>{t('privacy.chain.li1')}</li>
                <li>{t('privacy.chain.li2')}</li>
                <li>{t('privacy.chain.li3')}</li>
              </ul>
              <p>{t('privacy.chain.p2')}</p>
            </>
          ),
        },
        { id: 'purposes', heading: t('privacy.purposes.title'), body: <p>{t('privacy.purposes.text')}</p> },
        { id: 'retention', heading: t('privacy.retention.title'), body: <p>{t('privacy.retention.text')}</p> },
        { id: 'recipients', heading: t('privacy.recipients.title'), body: <p>{t('privacy.recipients.text')}</p> },
        {
          id: 'cookies',
          heading: t('privacy.cookies.title'),
          body: (
            <>
              <p>{t('privacy.cookies.p1')}</p>
              <ul>
                <li>
                  <strong>{t('privacy.cookies.essential.label')}</strong> {t('privacy.cookies.essential.text')}
                </li>
                <li>
                  <strong>{t('privacy.cookies.analytics.label')}</strong> {t('privacy.cookies.analytics.text')}
                </li>
                <li>
                  <strong>{t('privacy.cookies.security.label')}</strong> {t('privacy.cookies.security.text')}
                </li>
              </ul>
              <p>{t('privacy.cookies.p2')}</p>
            </>
          ),
        },
        {
          id: 'rights',
          heading: t('privacy.rights.title'),
          body: (
            <>
              <p>{t('privacy.rights.intro')}</p>
              <ul>
                <li>{t('privacy.rights.li1')}</li>
                <li>{t('privacy.rights.li2')}</li>
                <li>{t('privacy.rights.li3')}</li>
                <li>{t('privacy.rights.li4')}</li>
              </ul>
              <p>
                {t('privacy.rights.contact')} {mail}
              </p>
            </>
          ),
        },
        { id: 'security', heading: t('privacy.security.title'), body: <p>{t('privacy.security.text')}</p> },
        {
          id: 'terms-link',
          heading: t('privacy.terms.title'),
          body: (
            <p>
              {t('privacy.terms.text')} <Link to="/terms">{t('terms.title')}</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}

/** Conditions générales d'utilisation du service. */
export function Terms() {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('terms.title')}
      description={t('seo.terms.description')}
      path="/terms"
      sections={[
        { id: 'object', heading: t('terms.object.title'), body: <p>{t('terms.object.text', { institution: config.institution })}</p> },
        {
          id: 'access',
          heading: t('terms.access.title'),
          body: (
            <>
              <p>{t('terms.access.p1')}</p>
              <ul>
                <li>{t('terms.access.li1')}</li>
                <li>{t('terms.access.li2')}</li>
                <li>{t('terms.access.li3')}</li>
              </ul>
              <p>{t('terms.access.p2')}</p>
            </>
          ),
        },
        {
          id: 'obligations',
          heading: t('terms.obligations.title'),
          body: (
            <>
              <p>{t('terms.obligations.intro')}</p>
              <ul>
                <li>{t('terms.obligations.li1')}</li>
                <li>{t('terms.obligations.li2')}</li>
                <li>{t('terms.obligations.li3')}</li>
                <li>{t('terms.obligations.li4')}</li>
              </ul>
            </>
          ),
        },
        { id: 'value', heading: t('terms.value.title'), body: <p>{t('terms.value.text')}</p> },
        { id: 'availability', heading: t('terms.availability.title'), body: <p>{t('terms.availability.text')}</p> },
        { id: 'liability', heading: t('terms.liability.title'), body: <p>{t('terms.liability.text')}</p> },
        { id: 'ip', heading: t('terms.ip.title'), body: <p>{t('terms.ip.text', { institution: config.institution })}</p> },
        {
          id: 'personal-data',
          heading: t('terms.data.title'),
          body: (
            <p>
              {t('terms.data.text')} <Link to="/privacy">{t('privacy.title')}</Link>.
            </p>
          ),
        },
        { id: 'changes', heading: t('terms.changes.title'), body: <p>{t('terms.changes.text')}</p> },
        { id: 'law', heading: t('terms.law.title'), body: <p>{t('terms.law.text')}</p> },
      ]}
    />
  );
}
