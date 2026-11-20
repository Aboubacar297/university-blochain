import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityConfig } from '../config/configuration';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const IV_LENGTH = 12; // GCM
const TAG_LENGTH = 16;

@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly pepper: string;

  constructor(config: ConfigService) {
    const sec = config.getOrThrow<SecurityConfig>('security');
    this.key = Buffer.from(sec.encryptionKeyHex, 'hex');
    this.pepper = sec.studentRefPepper;
  }

  /** Empreinte SHA-256 (hex) d'un contenu : c'est cette valeur qui est inscrite dans Fabric. */
  sha256Hex(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Pseudonymisation de l'identifiant étudiant (RGPD) : seule cette référence
   * HMAC-SHA256 est écrite sur la blockchain, jamais l'identifiant en clair.
   */
  studentRef(studentId: string): string {
    return createHmac('sha256', this.pepper).update(studentId.trim().toLowerCase()).digest('hex');
  }

  /** Chiffrement AES-256-GCM. Format : [IV 12 o][tag 16 o][données chiffrées]. */
  encrypt(plain: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]);
  }

  decrypt(payload: Buffer): Buffer {
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = payload.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  safeEqualHex(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
  }
}
