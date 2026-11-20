import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { AuthUser, Role } from '../auth/auth.types';
import { CryptoService } from '../common/crypto.service';
import { isRealPastDate } from '../common/normalize';
import { StoreService } from '../common/store.service';
import { AccessConfig, SecurityConfig } from '../config/configuration';
import { FabricService } from '../fabric/fabric.service';
import { StorageService } from '../storage/storage.service';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { RevokeDiplomaDto } from './dto/revoke-diploma.dto';
import { DiplomaRecord, HistoryEntry, StudentIdentity, TxProof } from './diploma.model';

export interface VerificationResult {
  diplomaId: string;
  valid: boolean;
  status: DiplomaRecord['status'];
  hashMatches: boolean;
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  revokedAt?: string;
  checkedAt: string;
}

export interface TransactionVerification {
  txId: string;
  txType: TxProof['type'];
  txTimestamp: string;
  valid: boolean;
  status: DiplomaRecord['status'];
  diplomaId: string;
  institution: string;
  degree: string;
  major: string;
  issueDate: string;
  revokedAt?: string;
  checkedAt: string;
}

const TX_ID_RE = /^[0-9a-f]{64}$/;

@Injectable()
export class DiplomasService {
  private readonly logger = new Logger(DiplomasService.name);
  private readonly shareSecret: Uint8Array;
  private readonly issuerUrl: string;

  constructor(
    private readonly fabric: FabricService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly store: StoreService,
    config: ConfigService,
  ) {
    this.shareSecret = new TextEncoder().encode(config.getOrThrow<SecurityConfig>('security').shareTokenSecret);
    this.issuerUrl = config.getOrThrow<AccessConfig>('access').issuerUrl;
  }

  // ===========================================================================
  // Émission (Université / Org1)
  // ===========================================================================
  async create(dto: CreateDiplomaDto, file: Express.Multer.File | undefined, user: AuthUser): Promise<DiplomaRecord> {
    const pdf = this.assertPdf(file);

    const errors: string[] = [];
    if (!isRealPastDate(dto.birthDate)) errors.push('La date de naissance est invalide ou située dans le futur.');
    if (new Date(`${dto.issueDate.slice(0, 10)}T00:00:00Z`).getTime() > Date.now()) errors.push("La date d'émission ne peut pas être dans le futur.");
    if (dto.year > new Date().getUTCFullYear() + 1) errors.push("L'année du diplôme est invalide.");
    if (errors.length > 0) throw new BadRequestException(errors);

    const diplomaId = randomUUID();
    const documentHash = this.crypto.sha256Hex(pdf);
    const studentRef = this.crypto.studentRef(dto.studentId);
    const storageRef = `diplomas/${diplomaId}.pdf.enc`;
    const metaRef = this.metaRef(diplomaId);
    const identity: StudentIdentity = { fullName: dto.fullName, birthDate: dto.birthDate, email: dto.email, year: dto.year };

    // 1) Dépôt hors chaîne (chiffré AES-256-GCM) du PDF et des données d'identité
    await this.storage.put(storageRef, this.crypto.encrypt(pdf), { 'x-amz-meta-diploma-id': diplomaId });
    await this.storage.put(metaRef, this.crypto.encrypt(Buffer.from(JSON.stringify(identity), 'utf8')));

    // 2) Inscription de l'empreinte et des métadonnées non personnelles dans Fabric ; compensation si échec
    try {
      const record = await this.fabric.submit<DiplomaRecord>(
        'CreateDiploma',
        diplomaId,
        studentRef,
        dto.institution,
        dto.degree,
        dto.major ?? '',
        dto.issueDate,
        documentHash,
        storageRef,
        user.sub,
      );
      this.logger.log(`Diplôme émis : ${diplomaId} par ${user.username ?? user.sub}`);
      return record as DiplomaRecord;
    } catch (err) {
      await this.storage.remove(storageRef).catch(() => undefined);
      await this.storage.remove(metaRef).catch(() => undefined);
      throw err;
    }
  }

  // ===========================================================================
  // Consultation
  // ===========================================================================
  async findOne(id: string, user: AuthUser): Promise<DiplomaRecord> {
    const record = await this.read(id);
    this.assertCanAccess(user, record);
    return record;
  }

  async listMine(user: AuthUser): Promise<DiplomaRecord[]> {
    if (!user.studentId) throw new ForbiddenException("Le jeton ne contient pas de claim 'student_id'.");
    return this.listByStudentId(user.studentId);
  }

  async listByStudentId(studentId: string): Promise<DiplomaRecord[]> {
    const ref = this.crypto.studentRef(studentId);
    return (await this.fabric.evaluate<DiplomaRecord[]>('GetDiplomasByStudent', ref)) ?? [];
  }

  async listAll(): Promise<DiplomaRecord[]> {
    return (await this.fabric.evaluate<DiplomaRecord[]>('GetAllDiplomas')) ?? [];
  }

  async history(id: string): Promise<HistoryEntry[]> {
    return (await this.fabric.evaluate<HistoryEntry[]>('GetDiplomaHistory', id)) ?? [];
  }

  /** Données d'identité hors chaîne (déchiffrées) : réservées à la vérification d'identité lors d'une demande d'accès. */
  async identityOf(diplomaId: string): Promise<StudentIdentity | null> {
    try {
      const raw = await this.storage.get(this.metaRef(diplomaId));
      return JSON.parse(this.crypto.decrypt(raw).toString('utf8')) as StudentIdentity;
    } catch {
      return null;
    }
  }

  async downloadDocument(id: string, user: AuthUser): Promise<Buffer> {
    const record = await this.read(id);
    this.assertCanAccess(user, record);
    const encrypted = await this.storage.get(record.storageRef);
    const pdf = this.crypto.decrypt(encrypted);

    if (!this.crypto.safeEqualHex(this.crypto.sha256Hex(pdf), record.documentHash)) {
      this.logger.error(`Intégrité compromise pour le diplôme ${id}`);
      throw new ForbiddenException("L'intégrité du document stocké est compromise.");
    }
    return pdf;
  }

  /**
   * Justificatif au format Open Badges 3.0 (W3C Verifiable Credentials Data Model 2.0), sans signature.
   * Document d'interopérabilité : l'authenticité s'établit par l'empreinte inscrite dans la blockchain (champ evidence).
   */
  async credential(id: string, user: AuthUser): Promise<Record<string, unknown>> {
    const d = await this.read(id);
    this.assertCanAccess(user, d);
    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(d.issueDate) ? `${d.issueDate}T00:00:00Z` : d.issueDate;
    return {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
      ],
      id: `urn:uuid:${d.diplomaId}`,
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      name: d.degree,
      issuer: { id: this.issuerUrl, type: ['Profile'], name: d.institution },
      validFrom,
      credentialSubject: {
        type: ['AchievementSubject'],
        identifier: [{ type: 'IdentityObject', hashed: true, identityType: 'studentId', identityHash: d.studentRef }],
        achievement: {
          id: `urn:uuid:${d.diplomaId}`,
          type: ['Achievement'],
          achievementType: 'Degree',
          name: d.degree,
          description: d.major ? `${d.degree}, ${d.major}` : d.degree,
          criteria: { narrative: `Diplôme délivré par ${d.institution} et enregistré dans le registre Hyperledger Fabric.` },
        },
      },
      evidence: [
        {
          type: ['Evidence'],
          id: `urn:fabric:tx:${d.txId}`,
          name: 'Enregistrement dans le registre Hyperledger Fabric',
          description: `Empreinte SHA-256 du document : ${d.documentHash}. Transaction : ${d.txId}.`,
          genre: 'Blockchain',
        },
      ],
    };
  }

  // ===========================================================================
  // Révocation (Université / Ministère)
  // ===========================================================================
  async revoke(id: string, dto: RevokeDiplomaDto, user: AuthUser): Promise<DiplomaRecord> {
    const record = await this.fabric.submit<DiplomaRecord>('RevokeDiploma', id, dto.reason, user.sub);
    this.logger.warn(`Diplôme révoqué : ${id} par ${user.username ?? user.sub}`);
    return record as DiplomaRecord;
  }

  // ===========================================================================
  // Vérification (Recruteur)
  // ===========================================================================
  async verifyDocument(id: string, file: Express.Multer.File | undefined): Promise<VerificationResult> {
    const pdf = this.assertPdf(file);
    const record = await this.read(id);
    const hashMatches = this.crypto.safeEqualHex(this.crypto.sha256Hex(pdf), record.documentHash);
    await this.store.countVerification();
    return this.toVerification(record, hashMatches);
  }

  /** Vérification instantanée d'une transaction du registre (identifiant de transaction ou QR code). */
  async verifyTransaction(txId: string): Promise<TransactionVerification> {
    const id = txId.trim().toLowerCase();
    if (!TX_ID_RE.test(id)) throw new BadRequestException("L'identifiant de transaction doit contenir 64 caractères hexadécimaux.");
    const proof = await this.fabric.evaluate<TxProof>('GetDiplomaByTx', id);
    if (!proof) throw new NotFoundException('Transaction introuvable dans le registre.');
    const d = proof.diploma;
    await this.store.countVerification();
    return {
      txId: proof.txId,
      txType: proof.type,
      txTimestamp: proof.timestamp,
      valid: proof.type === 'ISSUED' && d.status === 'VALID',
      status: d.status,
      diplomaId: d.diplomaId,
      institution: d.institution,
      degree: d.degree,
      major: d.major,
      issueDate: d.issueDate,
      revokedAt: d.revokedAt,
      checkedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // Partage par l'étudiant (lien signé à durée limitée)
  // ===========================================================================
  async share(id: string, ttlMinutes: number | undefined, user: AuthUser) {
    const record = await this.read(id);
    this.assertOwner(user, record);

    const ttl = ttlMinutes ?? 60;
    const token = await new SignJWT({ diplomaId: id, purpose: 'share' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${ttl}m`)
      .sign(this.shareSecret);

    return { token, expiresAt: new Date(Date.now() + ttl * 60_000).toISOString(), verifyUrlPath: `/public/verify/${token}` };
  }

  async verifyShareToken(token: string): Promise<VerificationResult> {
    let diplomaId: string;
    try {
      const { payload } = await jwtVerify(token, this.shareSecret, { algorithms: ['HS256'] });
      if (payload['purpose'] !== 'share' || typeof payload['diplomaId'] !== 'string') throw new Error('bad token');
      diplomaId = payload['diplomaId'];
    } catch {
      throw new UnauthorizedException('Lien de partage invalide ou expiré.');
    }
    const record = await this.read(diplomaId);
    await this.store.countVerification();
    return this.toVerification(record, true);
  }

  // ===========================================================================
  // Utilitaires
  // ===========================================================================
  private metaRef(id: string): string {
    return `diplomas/${id}.meta.enc`;
  }

  private async read(id: string): Promise<DiplomaRecord> {
    const record = await this.fabric.evaluate<DiplomaRecord>('ReadDiploma', id);
    if (!record) throw new NotFoundException('Diplôme introuvable.');
    return record;
  }

  private toVerification(record: DiplomaRecord, hashMatches: boolean): VerificationResult {
    return {
      diplomaId: record.diplomaId,
      valid: record.status === 'VALID' && hashMatches,
      status: record.status,
      hashMatches,
      institution: record.institution,
      degree: record.degree,
      major: record.major,
      issueDate: record.issueDate,
      revokedAt: record.revokedAt,
      checkedAt: new Date().toISOString(),
    };
  }

  private assertPdf(file: Express.Multer.File | undefined): Buffer {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Un fichier PDF est requis (champ multipart "file").');
    }
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException("Le fichier fourni n'est pas un PDF valide.");
    }
    return file.buffer;
  }

  private assertCanAccess(user: AuthUser, record: DiplomaRecord): void {
    if (user.roles.includes(Role.University) || user.roles.includes(Role.Ministry)) return;
    if (user.roles.includes(Role.Recruiter)) return;
    this.assertOwner(user, record);
  }

  private assertOwner(user: AuthUser, record: DiplomaRecord): void {
    if (!user.studentId || !this.crypto.safeEqualHex(this.crypto.studentRef(user.studentId), record.studentRef)) {
      throw new ForbiddenException("Ce diplôme n'est pas associé à votre compte.");
    }
  }
}
