/** Normalise un texte pour comparaison : minuscules, sans accents, espaces réduits. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const INE_PATTERN = /^[A-Z0-9]{9,12}$/;
export const NAME_PATTERN = /^[\p{L}][\p{L}' .-]{1,119}$/u;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Date AAAA-MM-JJ réelle (refuse le 31 février) et comprise entre 1900 et aujourd'hui. */
export function isRealPastDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  return d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}
