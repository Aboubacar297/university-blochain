import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { useI18n } from '../i18n';
import { Notice } from './Feedback';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('turnstile'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Contrôle anti-robot Cloudflare Turnstile. Le jeton est vérifié côté serveur avec la clé secrète (jamais exposée ici).
 * Service de sécurité strictement nécessaire : chargé uniquement sur la page de demande d'accès.
 */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const { lang, t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let widget: string | undefined;
    let alive = true;
    setFailed(false);
    onToken(null);
    loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        widget = window.turnstile.render(ref.current, {
          sitekey: config.turnstileSiteKey,
          theme: 'dark',
          language: lang,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => {
            onToken(null);
            setFailed(true);
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, resetKey]);

  return (
    <div>
      <div ref={ref} className="turnstile" />
      {failed && (
        <Notice tone="danger" title={t('turnstile.failed.title')}>
          {t('turnstile.failed.text')}
        </Notice>
      )}
    </div>
  );
}
