import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DiplomasService } from '../diplomas/diplomas.service';

/** Endpoint public (sans compte) : vérification via un lien de partage signé par l'étudiant. */
@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly diplomas: DiplomasService) {}

  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.diplomas.verifyShareToken(token);
  }
}
