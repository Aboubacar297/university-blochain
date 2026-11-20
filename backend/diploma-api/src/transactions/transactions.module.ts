import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiplomasModule } from '../diplomas/diplomas.module';
import { TransactionsController } from './transactions.controller';

@Module({ imports: [AuthModule, DiplomasModule], controllers: [TransactionsController] })
export class TransactionsModule {}
