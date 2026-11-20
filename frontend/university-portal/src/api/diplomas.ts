import type {
  AccessGrant,
  AccessStatus,
  CreateDiplomaInput,
  Diploma,
  HistoryEntry,
  RequestAccessInput,
  ShareLink,
  Stats,
  TransactionVerification,
  VerificationResult,
} from '../types';
import { request } from './client';

export const diplomasApi = {
  create(input: CreateDiplomaInput) {
    const form = new FormData();
    form.append('studentId', input.studentId);
    form.append('fullName', input.fullName);
    form.append('birthDate', input.birthDate);
    form.append('email', input.email);
    form.append('year', String(input.year));
    form.append('institution', input.institution);
    form.append('degree', input.degree);
    if (input.major) form.append('major', input.major);
    form.append('issueDate', input.issueDate);
    form.append('file', input.file);
    return request<Diploma>('/diplomas', { method: 'POST', body: form });
  },

  list: () => request<Diploma[]>('/diplomas'),
  mine: () => request<Diploma[]>('/diplomas/me'),
  get: (id: string) => request<Diploma>(`/diplomas/${id}`),
  history: (id: string) => request<HistoryEntry[]>(`/diplomas/${id}/history`),
  document: (id: string) => request<Blob>(`/diplomas/${id}/document`),

  /** Justificatif Open Badges 3.0, remis sous forme de fichier JSON-LD. */
  credential: async (id: string) => {
    const data = await request<unknown>(`/diplomas/${id}/credential`);
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/ld+json' });
  },

  revoke: (id: string, reason: string) =>
    request<Diploma>(`/diplomas/${id}/revoke`, { method: 'POST', json: { reason } }),

  share: (id: string, ttlMinutes: number) =>
    request<ShareLink>(`/diplomas/${id}/share`, { method: 'POST', json: { ttlMinutes } }),

  verify(diplomaId: string, file: File) {
    const form = new FormData();
    form.append('diplomaId', diplomaId);
    form.append('file', file);
    return request<VerificationResult>('/diplomas/verify', { method: 'POST', body: form });
  },

  verifyShare: (token: string) =>
    request<VerificationResult>(`/public/verify/${encodeURIComponent(token)}`, { auth: false }),
};

export const transactionsApi = {
  verify: (txId: string) => request<TransactionVerification>(`/transactions/${encodeURIComponent(txId)}`),
};

export const statsApi = {
  get: () => request<Stats>('/stats'),
};

export const accessApi = {
  /** Public : création ou régénération de l'accès étudiant (30 jours). */
  request: (input: RequestAccessInput) => request<AccessGrant>('/access/request', { method: 'POST', json: input, auth: false }),
  me: () => request<AccessStatus>('/access/me'),
};
