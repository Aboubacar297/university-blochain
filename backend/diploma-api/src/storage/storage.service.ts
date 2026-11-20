import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MinioConfig } from '../config/configuration';

/** Stockage hors chaîne (MinIO / S3 privé) : seuls des objets déjà chiffrés y sont déposés. */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const m = this.config.getOrThrow<MinioConfig>('minio');
    this.bucket = m.bucket;
    this.client = new Client({
      endPoint: m.endPoint,
      port: m.port,
      useSSL: m.useSSL,
      accessKey: m.accessKey,
      secretKey: m.secretKey,
    });
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Bucket créé : ${this.bucket}`);
    }
  }

  async put(objectName: string, data: Buffer, meta: Record<string, string> = {}): Promise<void> {
    await this.client.putObject(this.bucket, objectName, data, data.length, {
      'Content-Type': 'application/octet-stream',
      ...meta,
    });
  }

  async get(objectName: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, objectName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async remove(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.client.bucketExists(this.bucket);
    } catch {
      return false;
    }
  }
}
