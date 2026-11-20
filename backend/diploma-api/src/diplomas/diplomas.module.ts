import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../common/crypto.module';
import { StorageModule } from '../storage/storage.module';
import { DiplomasController } from './diplomas.controller';
import { DiplomasService } from './diplomas.service';

@Module({
  imports: [AuthModule, CryptoModule, StorageModule],
  controllers: [DiplomasController],
  providers: [DiplomasService],
  exports: [DiplomasService],
})
export class DiplomasModule {}
