import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Loading, Notice } from '../components/Feedback';
import { TextField } from '../components/Field';
import { Icon } from '../components/Icon';
import { Tabs } from '../components/Tabs';
import { config } from '../config';
import { useI18n, type MessageKey } from '../i18n';
import { useSeo } from '../lib/useSeo';
import type { Role } from '../types';

const ROLES: Role[] = ['university', 'ministry', 'student', 'recruiter'];

function extractToken(input: string): string {
  const value = input.trim();
  const marker = '/v/';
  const at = value.indexOf(marker);
  return at >= 0 ? value.slice(at + marker.length).split(/[?#]/)[0] : value;
}

export function Home() {
  const { t } = useI18n();
  const { ready, authenticated, user, unavailable, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('student');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string>();
  useSeo({ title: '', description: t('seo.home.description'), path: '/' });

  if (!ready) return <Loading />;
  if (authenticated && user) {
    const target = homeFor(user.roles);
    if (target !== '/') return <Navigate to={target} replace />;
    return (
      <Notice tone="warning" title={t('home.noRole.title')}>
        {t('home.noRole.text')}
      </Notice>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const token = extractToken(link);
    if (token.length < 20) {
      setError(t('home.link.error'));
      return;
    }
    navigate(`/v/${token}`);
  }

  const step = (n: 1 | 2 | 3, part: 'title' | 'text') => t(`home.role.${role}.${n}.${part}` as MessageKey);

  return (
    <div className="home">
      {unavailable && (
        <Notice tone="danger" title={t('auth.unavailable.title')}>
          {t('auth.unavailable.text')}
        </Notice>
      )}

      <section className="home__hero" aria-labelledby="home-title">
        <div>
          <h1 id="home-title">{t('home.title')}</h1>
          <p className="home__lead">{t('home.lead', { institution: config.institution })}</p>
          <div className="actions">
            <Button variant="primary" onClick={() => login('/')}>
              {t('auth.login')}
            </Button>
          </div>
          <div className="home__links">
            <Link to="/request-access">{t('home.requestAccess')}</Link>
            <Link to="/request-access?mode=regenerate">{t('home.regenerate')}</Link>
          </div>
        </div>

        <aside className="card" aria-labelledby="guarantees-title">
          <h2 id="guarantees-title">{t('home.guarantees.title')}</h2>
          <ul className="guarantees">
            <li>
              <Icon name="shield" size={22} />
              <div>
                <strong>{t('home.guarantees.1.title')}</strong>
                <span>{t('home.guarantees.1.text')}</span>
              </div>
            </li>
            <li>
              <Icon name="lock" size={22} />
              <div>
                <strong>{t('home.guarantees.2.title')}</strong>
                <span>{t('home.guarantees.2.text')}</span>
              </div>
            </li>
            <li>
              <Icon name="calendar" size={22} />
              <div>
                <strong>{t('home.guarantees.3.title')}</strong>
                <span>{t('home.guarantees.3.text')}</span>
              </div>
            </li>
          </ul>
        </aside>
      </section>

      <section aria-labelledby="roles-title">
        <h2 id="roles-title">{t('home.roles.title')}</h2>
        <Tabs label={t('home.roles.label')} tabs={ROLES.map((r) => ({ id: r, label: t(`role.${r}` as MessageKey) }))} value={role} onChange={setRole}>
          <ol className="steps">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <h3>{step(n, 'title')}</h3>
                <p>{step(n, 'text')}</p>
              </li>
            ))}
          </ol>
        </Tabs>
      </section>

      <section className="home__link" aria-labelledby="link-title">
        <h2 id="link-title">{t('home.link.title')}</h2>
        <p className="muted">{t('home.link.text')}</p>
        <form onSubmit={submit} noValidate className="inline-form">
          <TextField
            id="share-link"
            label={t('home.link.label')}
            value={link}
            error={error}
            onChange={(e) => {
              setLink(e.target.value);
              setError(undefined);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" variant="link">
            {t('home.link.submit')}
          </Button>
        </form>
      </section>
    </div>
  );
}
