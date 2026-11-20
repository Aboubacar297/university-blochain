import type { MessageKey } from '../i18n';

/** Validation stricte côté client (confort de saisie). Les mêmes règles sont ré-appliquées côté serveur, seul juge. */
export type Check = MessageKey | null;

export const INE_RE = /^[A-Z0-9]{9,12}$/;
const NAME_RE = /^[\p{L}][\p{L}' .-]{1,119}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeIne = (v: string) => v.trim().toUpperCase();
export const todayIso = () => new Date().toISOString().slice(0, 10);

function parseDate(v: string): Date | null {
  if (!DATE_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export function validateIne(v: string): Check {
  const x = normalizeIne(v);
  if (!x) return 'val.ine.required';
  return INE_RE.test(x) ? null : 'val.ine.format';
}

export function validateFullName(v: string): Check {
  const x = v.trim();
  if (!x) return 'val.name.required';
  return NAME_RE.test(x) ? null : 'val.name.format';
}

export function validateEmail(v: string): Check {
  const x = v.trim();
  if (!x) return 'val.email.required';
  return x.length <= 254 && EMAIL_RE.test(x) ? null : 'val.email.format';
}

export function validateBirthDate(v: string): Check {
  if (!v) return 'val.birthDate.required';
  if (!DATE_RE.test(v)) return 'val.date.format';
  const d = parseDate(v);
  if (!d) return 'val.date.invalid';
  if (v > todayIso()) return 'val.birthDate.future';
  if (d.getUTCFullYear() < 1900) return 'val.birthDate.tooOld';
  const limit = new Date();
  limit.setUTCFullYear(limit.getUTCFullYear() - 14);
  return d.getTime() > limit.getTime() ? 'val.birthDate.tooYoung' : null;
}

export function validateIssueDate(v: string): Check {
  if (!v) return 'val.issueDate.required';
  if (!DATE_RE.test(v)) return 'val.date.format';
  if (!parseDate(v)) return 'val.date.invalid';
  return v > todayIso() ? 'val.issueDate.future' : null;
}

export function validateYear(v: string): Check {
  if (!v.trim()) return 'val.year.required';
  const n = Number(v);
  const max = new Date().getUTCFullYear() + 1;
  return Number.isInteger(n) && n >= 1950 && n <= max ? null : 'val.year.invalid';
}

export function validateDegree(v: string): Check {
  return v.trim() ? null : 'val.degree.required';
}

export const isTxId = (v: string) => /^[0-9a-f]{64}$/.test(v.trim().toLowerCase());
