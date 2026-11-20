import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessService } from './access.service';

/** Verrouillage automatique des accès étudiants après 30 jours. */
@Injectable()
export class AccessLifecycleJob implements OnApplicationBootstrap {
  constructor(private readonly access: AccessService) {}

  onApplicationBootstrap(): void {
    void this.access.lockExpired().catch(() => undefined);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.access.lockExpired();
  }
}
