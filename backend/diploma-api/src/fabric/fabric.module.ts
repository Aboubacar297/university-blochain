import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FabricService } from './fabric.service';
import { MockFabricService } from './fabric-mock.service';

// FABRIC_MOCK=true : registre en mémoire (développement sans réseau Fabric).
// Le choix est fait à l'initialisation, une fois le fichier .env chargé par ConfigModule.
@Global()
@Module({
  providers: [
    {
      provide: FabricService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('FABRIC_MOCK') === 'true' ? new MockFabricService() : new FabricService(config),
    },
  ],
  exports: [FabricService],
})
export class FabricModule {}
