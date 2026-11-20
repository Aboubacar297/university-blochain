import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FabricService } from '../fabric/fabric.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly fabric: FabricService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check() {
    const [fabric, minio] = await Promise.all([this.fabric.isHealthy(), this.storage.isHealthy()]);
    return { status: fabric && minio ? 'ok' : 'degraded', fabric, minio, time: new Date().toISOString() };
  }
}
