import { Module } from '@nestjs/common';
import { DiplomasModule } from '../diplomas/diplomas.module';
import { PublicController } from './public.controller';

@Module({
  imports: [DiplomasModule],
  controllers: [PublicController],
})
export class PublicModule {}
