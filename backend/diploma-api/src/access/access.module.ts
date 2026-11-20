import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiplomasModule } from '../diplomas/diplomas.module';
import { AccessController } from './access.controller';
import { AccessLifecycleJob } from './access.cron';
import { AccessService } from './access.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { TurnstileService } from './turnstile.service';

@Module({
  imports: [AuthModule, DiplomasModule],
  controllers: [AccessController],
  providers: [AccessService, AccessLifecycleJob, KeycloakAdminService, TurnstileService],
})
export class AccessModule {}
