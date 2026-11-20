import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DiplomaRecord, HistoryEntry, TxProof } from '../diplomas/diploma.model';

/**
 * MODE SIMULÉ (FABRIC_MOCK=true) : registre en mémoire qui imite le chaincode `diplomacontract`.
 * Réservé au développement : les données sont perdues à chaque redémarrage et rien n'est écrit dans Fabric.
 */
@Injectable()
export class MockFabricService implements OnModuleInit {
  private readonly logger = new Logger('MockFabric');
  private readonly store = new Map<string, DiplomaRecord>();
  private readonly history = new Map<string, HistoryEntry[]>();
  private readonly txIndex = new Map<string, { diplomaId: string; type: 'ISSUED' | 'REVOKED'; timestamp: string }>();

  onModuleInit(): void {
    this.logger.warn('MODE SIMULÉ actif : aucune connexion à Hyperledger Fabric (données en mémoire).');
  }

  async submit<T = unknown>(fn: string, ...args: string[]): Promise<T | null> {
    switch (fn) {
      case 'CreateDiploma': {
        const [diplomaId, studentRef, institution, degree, major, issueDate, documentHash, storageRef] = args;
        if (this.store.has(diplomaId)) throw new ConflictException('Ce diplôme existe déjà.');
        const record: DiplomaRecord = {
          docType: 'diploma',
          diplomaId,
          studentRef,
          institution,
          degree,
          major,
          issueDate,
          documentHash,
          storageRef,
          status: 'VALID',
          issuerMsp: 'Org1MSP',
          createdAt: new Date().toISOString(),
          txId: this.newTxId(),
        };
        this.txIndex.set(record.txId, { diplomaId, type: 'ISSUED', timestamp: record.createdAt });
        this.save(record);
        return this.clone(record) as T;
      }
      case 'RevokeDiploma': {
        const [diplomaId, reason] = args;
        const record = this.store.get(diplomaId);
        if (!record) throw new NotFoundException('Diplôme introuvable.');
        if (record.status === 'REVOKED') throw new ConflictException('Ce diplôme est déjà révoqué.');
        record.status = 'REVOKED';
        record.revokedAt = new Date().toISOString();
        record.revokeReason = reason;
        record.revokeTxId = this.newTxId();
        this.txIndex.set(record.revokeTxId, { diplomaId, type: 'REVOKED', timestamp: record.revokedAt });
        this.save(record);
        return this.clone(record) as T;
      }
      default:
        throw new NotFoundException(`Fonction inconnue : ${fn}`);
    }
  }

  async evaluate<T = unknown>(fn: string, ...args: string[]): Promise<T | null> {
    switch (fn) {
      case 'ReadDiploma': {
        const record = this.store.get(args[0]);
        if (!record) throw new NotFoundException('Diplôme introuvable.');
        return this.clone(record) as T;
      }
      case 'GetDiplomasByStudent':
        return [...this.store.values()].filter((d) => d.studentRef === args[0]).map((d) => this.clone(d)) as T;
      case 'GetAllDiplomas':
        return [...this.store.values()].map((d) => this.clone(d)) as T;
      case 'GetDiplomaByTx': {
        const entry = this.txIndex.get(args[0]);
        if (!entry) throw new NotFoundException('the transaction does not exist in the registry');
        const diploma = this.store.get(entry.diplomaId);
        if (!diploma) throw new NotFoundException('Diplôme introuvable.');
        return { txId: args[0], type: entry.type, timestamp: entry.timestamp, diploma: this.clone(diploma) } as T & TxProof;
      }
      case 'GetDiplomaHistory': {
        if (!this.history.has(args[0])) throw new NotFoundException('Diplôme introuvable.');
        return (this.history.get(args[0]) ?? []) as T;
      }
      default:
        throw new NotFoundException(`Fonction inconnue : ${fn}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  private save(record: DiplomaRecord): void {
    this.store.set(record.diplomaId, record);
    const entries = this.history.get(record.diplomaId) ?? [];
    entries.push({ txId: randomUUID().replace(/-/g, ''), timestamp: new Date().toISOString(), isDelete: false, value: this.clone(record) });
    this.history.set(record.diplomaId, entries);
  }

  private newTxId(): string {
    return randomBytes(32).toString('hex');
  }

  private clone<R>(v: R): R {
    return JSON.parse(JSON.stringify(v)) as R;
  }
}
