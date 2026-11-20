import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessConfig } from '../config/configuration';

/** Vérification côté serveur du jeton Cloudflare Turnstile (la clé secrète ne quitte jamais le backend). */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secret?: string;
  private readonly production: boolean;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<AccessConfig>('access').turnstileSecret;
    this.production = config.get<string>('nodeEnv') === 'production';
  }

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    if (!this.secret) {
      if (this.production) throw new ServiceUnavailableException('Protection anti-robot non configurée.');
      this.logger.warn('TURNSTILE_SECRET_KEY absent : vérification anti-robot ignorée (développement uniquement).');
      return true;
    }
    try {
      const body = new URLSearchParams({ secret: this.secret, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = (await res.json()) as { success?: boolean };
      return data.success === true;
    } catch (err) {
      this.logger.error(`Turnstile injoignable : ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException('Le contrôle anti-robot est momentanément indisponible.');
    }
  }
}
