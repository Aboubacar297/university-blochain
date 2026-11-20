import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { config } from '../config';
import { useI18n } from '../i18n';
import { Button } from './Button';
import { Dialog } from './Dialog';

const KEY = 'portal.consent.v1';
const SCRIPT_ID = 'analytics-script';

interface Consent {
  analytics: boolean;
  decidedAt: string;
  version: 1;
}

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    return c.version === 1 && typeof c.analytics === 'boolean' ? c : null;
  } catch {
    return null;
  }
}

function writeConsent(c: Consent) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}

interface ConsentContextValue {
  openSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

/**
 * Consentement RGPD : les traceurs non essentiels (mesure d'audience) ne sont chargés qu'après un choix explicite,
 * refuser est aussi simple qu'accepter, et le choix se modifie à tout moment depuis le pied de page.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [consent, setConsent] = useState<Consent | null>(readConsent);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(false);

  useEffect(() => {
    const existing = document.getElementById(SCRIPT_ID);
    if (consent?.analytics && config.analyticsDomain) {
      if (!existing) {
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.defer = true;
        s.src = config.analyticsSrc;
        s.setAttribute('data-domain', config.analyticsDomain);
        document.head.appendChild(s);
      }
    } else if (existing) {
      existing.remove();
    }
  }, [consent]);

  const decide = useCallback((analytics: boolean) => {
    const next: Consent = { analytics, decidedAt: new Date().toISOString(), version: 1 };
    writeConsent(next);
    setConsent(next);
    setSettingsOpen(false);
  }, []);

  const openSettings = useCallback(() => {
    setDraft(consent?.analytics ?? false);
    setSettingsOpen(true);
  }, [consent]);

  const value = useMemo(() => ({ openSettings }), [openSettings]);

  return (
    <ConsentContext.Provider value={value}>
      {children}

      {consent === null && !settingsOpen && (
        <section className="cookie-banner" aria-label={t('consent.title')}>
          <div className="cookie-banner__inner">
            <p className="cookie-banner__text">
              <strong>{t('consent.title')}</strong>
              {t('consent.text')} <Link to="/privacy#cookies">{t('consent.more')}</Link>
            </p>
            <div className="cookie-banner__actions">
              <Button variant="neutral" onClick={() => decide(false)}>
                {t('consent.reject')}
              </Button>
              <Button variant="neutral" onClick={() => decide(true)}>
                {t('consent.accept')}
              </Button>
              <Button variant="link" onClick={openSettings}>
                {t('consent.customize')}
              </Button>
            </div>
          </div>
        </section>
      )}

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t('consent.settings.title')}
        actions={
          <>
            <Button variant="link" onClick={() => setSettingsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => decide(draft)}>
              {t('consent.save')}
            </Button>
          </>
        }
      >
        <p>{t('consent.settings.intro')}</p>
        <div className="switch-row">
          <div>
            <h3 id="cookie-essential">{t('consent.essential.title')}</h3>
            <p>{t('consent.essential.text')}</p>
          </div>
          <input type="checkbox" className="switch" checked disabled aria-labelledby="cookie-essential" />
        </div>
        <div className="switch-row">
          <div>
            <h3 id="cookie-analytics">{t('consent.analytics.title')}</h3>
            <p>{config.analyticsDomain ? t('consent.analytics.text') : t('consent.analytics.disabled')}</p>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={draft}
            disabled={!config.analyticsDomain}
            onChange={(e) => setDraft(e.target.checked)}
            aria-labelledby="cookie-analytics"
          />
        </div>
      </Dialog>
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent doit être utilisé dans <ConsentProvider>');
  return ctx;
}
