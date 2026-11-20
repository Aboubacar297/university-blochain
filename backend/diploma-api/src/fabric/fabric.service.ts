import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, GatewayError, hash, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { FabricConfig } from '../config/configuration';

/**
 * Passerelle vers le réseau Hyperledger Fabric (Fabric Gateway, SDK v2.4+).
 * Une seule connexion gRPC est maintenue pour toute la durée de vie de l'application.
 */
@Injectable()
export class FabricService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FabricService.name);
  private client!: grpc.Client;
  private gateway!: Gateway;
  private contract!: Contract;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const f = this.config.getOrThrow<FabricConfig>('fabric');

    const tlsRootCert = await fs.readFile(f.tlsCertPath);
    this.client = new grpc.Client(f.peerEndpoint, grpc.credentials.createSsl(tlsRootCert), {
      'grpc.ssl_target_name_override': f.peerHostAlias,
    });

    const credentials = await fs.readFile(await this.resolveFile(f.certPath));
    const privateKeyPem = await fs.readFile(await this.resolveFile(f.keyPath));
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    this.gateway = connect({
      client: this.client,
      identity: { mspId: f.mspId, credentials },
      signer: signers.newPrivateKeySigner(privateKey),
      hash: hash.sha256,
      evaluateOptions: () => ({ deadline: Date.now() + 5_000 }),
      endorseOptions: () => ({ deadline: Date.now() + 15_000 }),
      submitOptions: () => ({ deadline: Date.now() + 5_000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });

    const network = this.gateway.getNetwork(f.channel);
    this.contract = network.getContract(f.chaincode);
    this.logger.log(`Connecté à Fabric : canal=${f.channel}, chaincode=${f.chaincode}, MSP=${f.mspId}`);
  }

  onModuleDestroy(): void {
    this.gateway?.close();
    this.client?.close();
  }

  /** Transaction qui modifie le ledger (endossement + ordonnancement + commit). */
  async submit<T = unknown>(fn: string, ...args: string[]): Promise<T | null> {
    try {
      const result = await this.contract.submitTransaction(fn, ...args);
      return this.parse<T>(result);
    } catch (err) {
      throw this.toHttpError(fn, err);
    }
  }

  /** Requête en lecture seule (n'écrit rien dans le ledger). */
  async evaluate<T = unknown>(fn: string, ...args: string[]): Promise<T | null> {
    try {
      const result = await this.contract.evaluateTransaction(fn, ...args);
      return this.parse<T>(result);
    } catch (err) {
      throw this.toHttpError(fn, err);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.contract.evaluateTransaction('GetAllDiplomas');
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------

  private async resolveFile(p: string): Promise<string> {
    const stat = await fs.stat(p);
    if (!stat.isDirectory()) return p;
    const files = (await fs.readdir(p)).sort();
    if (files.length === 0) throw new Error(`Dossier vide : ${p}`);
    return path.join(p, files[0]);
  }

  private parse<T>(result: Uint8Array): T | null {
    const text = Buffer.from(result).toString('utf8');
    if (text.length === 0) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private extractMessage(err: unknown): string {
    if (err instanceof GatewayError) {
      const details = err.details?.map((d) => d.message).filter(Boolean);
      if (details && details.length > 0) return details.join(' | ');
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** Traduit les erreurs du chaincode / de la passerelle en erreurs HTTP. */
  private toHttpError(fn: string, err: unknown): Error {
    const msg = this.extractMessage(err);
    this.logger.warn(`Échec ${fn} : ${msg}`);

    if (/invalid argument/i.test(msg)) return new BadRequestException(msg.replace(/^.*invalid argument:?\s*/i, 'Paramètre invalide : '));
    if (/does not exist|not found|n'existe pas/i.test(msg)) return new NotFoundException('Diplôme introuvable.');
    if (/already exists|existe déjà/i.test(msg)) return new ConflictException('Ce diplôme existe déjà.');
    if (/already revoked|déjà révoqué/i.test(msg)) return new ConflictException('Ce diplôme est déjà révoqué.');
    if (/access denied|not authorized|creator org|unauthorized/i.test(msg)) {
      return new ForbiddenException("L'identité du réseau n'est pas autorisée à exécuter cette opération.");
    }
    return new BadGatewayException('Erreur de communication avec le réseau Hyperledger Fabric.');
  }
}
