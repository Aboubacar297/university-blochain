import type { Lang } from '../i18n';

const localeOf = (lang: Lang) => (lang === 'fr' ? 'fr-MA' : 'en-GB');

/** Date calendaire (AAAA-MM-JJ ou ISO 8601) affichée sans décalage de fuseau horaire. */
export function formatDate(lang: Lang, value: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(localeOf(lang), { dateStyle: 'long', timeZone: 'UTC' }).format(d);
}

export function formatDateTime(lang: Lang, value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(localeOf(lang), { dateStyle: 'long', timeStyle: 'short' }).format(d);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export const shortId = (id: string) => id.slice(0, 8);
export const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
