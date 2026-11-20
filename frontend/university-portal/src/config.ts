const env = import.meta.env;

/**
 * Configuration publique du portail.
 * Toutes les variables VITE_* sont intégrées au code envoyé au navigateur : elles ne doivent contenir AUCUN secret.
 * Les secrets (clé secrète Turnstile, secret du compte de service Keycloak, clés de chiffrement) sont uniquement
 * dans le fichier .env du backend.
 */
function value(name: string, devDefault: string): string {
  const v = env[name] as string | undefined;
  if (v && v.trim() !== '') return v.trim();
  if (env.PROD) throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  return devDefault;
}

const optional = (name: string): string => String((env[name] as string | undefined) ?? '').trim();
const stripSlash = (v: string) => v.replace(/\/+$/, '');

export const config = {
  apiUrl: stripSlash(value('VITE_API_URL', 'http://localhost:3000')),
  keycloak: {
    url: stripSlash(value('VITE_KEYCLOAK_URL', 'http://localhost:8080')),
    realm: value('VITE_KEYCLOAK_REALM', 'university'),
    clientId: value('VITE_KEYCLOAK_CLIENT_ID', 'diploma-frontend'),
  },
  siteUrl: stripSlash(value('VITE_SITE_URL', 'http://localhost:5173')),
  siteName: value('VITE_SITE_NAME', 'Registre des diplômes'),
  institution: value('VITE_INSTITUTION_NAME', 'Université Mohammed V de Rabat'),
  privacyEmail: value('VITE_PRIVACY_EMAIL', 'dpo@example.org'),
  maxPdfMb: Number(optional('VITE_MAX_PDF_MB') || 10),
  /** Clé PUBLIQUE Cloudflare Turnstile (la clé secrète reste dans le backend). */
  turnstileSiteKey: value('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA'),
  /** Mesure d'audience (Plausible) : chargée uniquement après consentement. Vide = désactivée. */
  analyticsDomain: optional('VITE_ANALYTICS_DOMAIN'),
  analyticsSrc: optional('VITE_ANALYTICS_SRC') || 'https://plausible.io/js/script.js',
  /** Avertissement tant que les pages légales n'ont pas été validées par le DPO / le service juridique. */
  legalDraft: optional('VITE_LEGAL_DRAFT') === 'true',
} as const;
