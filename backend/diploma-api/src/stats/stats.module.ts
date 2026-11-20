import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiplomasModule } from '../diplomas/diplomas.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({ imports: [AuthModule, DiplomasModule], controllers: [StatsController], providers: [StatsService] })
export class StatsModule {}
