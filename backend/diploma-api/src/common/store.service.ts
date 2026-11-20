import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AccessConfig } from '../config/configuration';

export interface AccountRecord {
  username: string; // identifiant étudiant (INE), en majuscules
  keycloakUserId: string;
  grantedAt: string;
  expiresAt: string;
  lockedAt?: string;
  regenerations: number;
}

interface State {
  accounts: Record<string, AccountRecord>;
  verifications: Record<string, number>; // AAAA-MM -> nombre de vérifications
}

/**
 * Persistance légère (fichier JSON, écriture atomique) du cycle de vie des accès et des compteurs de vérification.
 * Pour une exploitation multi-instances, remplacer par une base de données (PostgreSQL, par exemple).
 */
@Injectable()
export class StoreService implements OnModuleInit {
  private readonly logger = new Logger(StoreService.name);
  private state: State = { accounts: {}, verifications: {} };
  private readonly file: string;
  private writing: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.file = path.resolve(config.getOrThrow<AccessConfig>('access').dataDir, 'state.json');
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(this.file, 'utf8')) as Partial<State>;
      this.state = { accounts: saved.accounts ?? {}, verifications: saved.verifications ?? {} };
    } catch {
      this.logger.log('Aucun état précédent : démarrage avec un état vide.');
    }
  }

  getAccount(username: string): AccountRecord | undefined {
    return this.state.accounts[username];
  }

  allAccounts(): AccountRecord[] {
    return Object.values(this.state.accounts);
  }

  async saveAccount(record: AccountRecord): Promise<void> {
    this.state.accounts[record.username] = record;
    await this.persist();
  }

  async countVerification(at: Date = new Date()): Promise<void> {
    const key = at.toISOString().slice(0, 7);
    this.state.verifications[key] = (this.state.verifications[key] ?? 0) + 1;
    await this.persist();
  }

  verifications(): Record<string, number> {
    return { ...this.state.verifications };
  }

  private persist(): Promise<void> {
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      await fs.rename(tmp, this.file);
    });
    return this.writing;
  }
}

@Global()
@Module({ providers: [StoreService], exports: [StoreService] })
export class StoreModule {}
