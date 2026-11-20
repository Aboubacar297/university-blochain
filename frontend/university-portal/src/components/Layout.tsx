import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../config';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import type { Role } from '../types';
import { Button } from './Button';
import { useConsent } from './CookieConsent';
import { Loading } from './Feedback';
import { Icon } from './Icon';
import { Logo } from './Logo';

const NAV: Array<{ to: string; key: MessageKey; roles: Role[] }> = [
  { to: '/issue', key: 'nav.issue', roles: ['university'] },
  { to: '/dashboard', key: 'nav.dashboard', roles: ['ministry', 'university'] },
  { to: '/diplomas', key: 'nav.registry', roles: ['university', 'ministry'] },
  { to: '/verify', key: 'nav.verify', roles: ['recruiter', 'university', 'ministry'] },
  { to: '/my-diplomas', key: 'nav.mine', roles: ['student'] },
];

function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  const options: Array<{ code: Lang; label: string }> = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
  ];
  return (
    <div className="lang" role="group" aria-label={t('lang.label')}>
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          lang={o.code}
          className="lang__btn"
          aria-pressed={lang === o.code}
          onClick={() => setLang(o.code)}
        >
          {o.code.toUpperCase()}
          <span className="visually-hidden"> {o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  const { user, authenticated, ready, hasRole, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const items = NAV.filter((n) => hasRole(...n.roles));

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        {t('a11y.skip')}
      </a>
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <Logo size={38} />
          <span className="brand__text">
            <span className="brand__name">{config.institution}</span>
            <span className="brand__sub">{t('app.name')}</span>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'x' : 'menu'} />
          <span>{t('nav.menu')}</span>
        </button>

        <div id="site-menu" className={`site-menu${open ? ' is-open' : ''}`}>
          {authenticated && items.length > 0 && (
            <nav className="nav" aria-label={t('nav.main')}>
              {items.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}>
                  {t(n.key)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="site-tools">
            <LanguageSwitch />
            {ready && authenticated && user && (
              <div className="account">
                <div className="account__who">
                  <Icon name="user" size={18} />
                  <span>
                    <span className="account__name">{user.name}</span>
                    <span className="account__role">{user.roles.map((r) => t(`role.${r}` as MessageKey)).join(', ')}</span>
                  </span>
                </div>
                <Button variant="link" icon={<Icon name="logout" size={18} />} onClick={logout}>
                  {t('auth.logout')}
                </Button>
              </div>
            )}
            {ready && !authenticated && (
              <Button variant="link" onClick={() => login('/')}>
                {t('auth.login')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function Layout() {
  const { t } = useI18n();
  const { openSettings } = useConsent();
  return (
    <div className="shell">
      <Header />
      <main id="main" tabIndex={-1} className="main">
        <div className="container">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>{t('footer.text', { institution: config.institution })}</p>
          <ul className="footer-links" aria-label={t('footer.legal')}>
            <li>
              <Link to="/privacy">{t('footer.privacy')}</Link>
            </li>
            <li>
              <Link to="/terms">{t('footer.terms')}</Link>
            </li>
            <li>
              <Button variant="link" className="btn--small" onClick={openSettings}>
                {t('footer.cookies')}
              </Button>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
