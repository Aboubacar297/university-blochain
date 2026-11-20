import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module';
import { StoreModule } from './common/store.service';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DiplomasModule } from './diplomas/diplomas.module';
import { FabricModule } from './fabric/fabric.module';
import { HealthModule } from './health/health.module';
import { PublicModule } from './public/public.module';
import { StatsModule } from './stats/stats.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    // Limitation de débit globale : 120 requêtes par minute et par adresse IP (plus strict sur les routes publiques)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    StoreModule,
    FabricModule,
    DiplomasModule,
    AccessModule,
    StatsModule,
    TransactionsModule,
    PublicModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
