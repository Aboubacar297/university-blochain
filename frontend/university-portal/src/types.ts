export type Role = 'university' | 'ministry' | 'recruiter' | 'student';
export type DiplomaStatus = 'VALID' | 'REVOKED';

export interface Diploma {
  docType: 'diploma';
  schemaVersion?: number;
  diplomaId: string;
  studentRef: string;
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  documentHash: string;
  storageRef: string;
  status: DiplomaStatus;
  issuerMsp: string;
  createdAt: string;
  txId: string;
  revokedAt?: string;
  revokeReason?: string;
  revokeTxId?: string;
}

export interface HistoryEntry {
  txId: string;
  timestamp: string;
  isDelete: boolean;
  value: Diploma | null;
}

export interface VerificationResult {
  diplomaId: string;
  valid: boolean;
  status: DiplomaStatus;
  hashMatches: boolean;
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  revokedAt?: string;
  checkedAt: string;
}

export interface ShareLink {
  token: string;
  expiresAt: string;
  verifyUrlPath: string;
}

export interface CreateDiplomaInput {
  studentId: string;
  fullName: string;
  birthDate: string;
  email: string;
  year: number;
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  file: File;
}

export interface TransactionVerification {
  txId: string;
  txType: 'ISSUED' | 'REVOKED';
  txTimestamp: string;
  valid: boolean;
  status: DiplomaStatus;
  diplomaId: string;
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  revokedAt?: string;
  checkedAt: string;
}

export interface MonthlyStat {
  month: string;
  issued: number;
  revoked: number;
  verifications: number;
}

export interface Stats {
  generatedAt: string;
  totals: { issued: number; valid: number; revoked: number; verifications: number };
  months: MonthlyStat[];
}

export interface RequestAccessInput {
  fullName: string;
  birthDate: string;
  ine: string;
  email: string;
  degree: string;
  year: number;
  turnstileToken: string;
  website: string;
}

export interface AccessGrant {
  username: string;
  temporaryPassword: string;
  expiresAt: string;
  mode: 'created' | 'regenerated';
}

export interface AccessStatus {
  managed: boolean;
  status?: 'ACTIVE' | 'EXPIRED';
  grantedAt?: string;
  expiresAt?: string;
  daysLeft?: number;
}
