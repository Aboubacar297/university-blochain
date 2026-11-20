export type DiplomaStatus = 'VALID' | 'REVOKED';

/** Représentation d'un diplôme dans le World State (CouchDB). Aucune donnée personnelle en clair. */
export interface DiplomaRecord {
  docType: 'diploma';
  diplomaId: string;
  studentRef: string; // HMAC-SHA256 pseudonymisé
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  documentHash: string; // SHA-256 du PDF original
  storageRef: string; // chemin de l'objet chiffré dans MinIO
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
  value: DiplomaRecord | null;
}

/** Preuve d'une transaction du registre (émission ou révocation). */
export interface TxProof {
  txId: string;
  type: 'ISSUED' | 'REVOKED';
  timestamp: string;
  diploma: DiplomaRecord;
}

/** Données d'identité conservées hors chaîne, chiffrées (jamais écrites dans la blockchain). */
export interface StudentIdentity {
  fullName: string;
  birthDate: string;
  email: string;
  year: number;
}
