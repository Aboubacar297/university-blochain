import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DiplomasService } from '../diplomas/diplomas.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly diplomas: DiplomasService) {}

  /** Vérification instantanée d'une transaction du registre (recruteur, Université, Ministère). */
  @Get(':txId')
  @Roles(Role.Recruiter, Role.University, Role.Ministry)
  verify(@Param('txId') txId: string) {
    return this.diplomas.verifyTransaction(txId);
  }
}
