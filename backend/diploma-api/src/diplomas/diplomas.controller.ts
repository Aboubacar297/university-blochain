import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DiplomasService } from './diplomas.service';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { RevokeDiplomaDto } from './dto/revoke-diploma.dto';
import { ShareDiplomaDto } from './dto/share-diploma.dto';
import { VerifyDiplomaDto } from './dto/verify-diploma.dto';

const MAX_PDF_BYTES = Number(process.env.MAX_PDF_SIZE_MB ?? 10) * 1024 * 1024;
const pdfUpload = () =>
  FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 1 } });

@ApiTags('diplomas')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('diplomas')
export class DiplomasController {
  constructor(private readonly diplomas: DiplomasService) {}

  /** Émission & signature (Université). Multipart : champ "file" (PDF) + métadonnées. */
  @Post()
  @Roles(Role.University)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(pdfUpload())
  create(
    @Body() dto: CreateDiplomaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.diplomas.create(dto, file, user);
  }

  /** Vérification instantanée : compare le PDF présenté à l'empreinte inscrite dans Fabric. */
  @Post('verify')
  @HttpCode(200)
  @Roles(Role.Recruiter, Role.University, Role.Ministry)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(pdfUpload())
  verify(@Body() dto: VerifyDiplomaDto, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.diplomas.verifyDocument(dto.diplomaId, file);
  }

  /** Liste du registre (Université et Ministère). */
  @Get()
  @Roles(Role.University, Role.Ministry)
  list() {
    return this.diplomas.listAll();
  }

  /** Diplômes de l'étudiant connecté. */
  @Get('me')
  @Roles(Role.Student)
  listMine(@CurrentUser() user: AuthUser) {
    return this.diplomas.listMine(user);
  }

  /** Audit national (Ministère). */
  @Get('audit/all')
  @Roles(Role.Ministry)
  listAll() {
    return this.diplomas.listAll();
  }

  @Get(':id')
  @Roles(Role.University, Role.Ministry, Role.Recruiter, Role.Student)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.diplomas.findOne(id, user);
  }

  /** Historique complet des transactions d'un diplôme (traçabilité). */
  @Get(':id/history')
  @Roles(Role.Ministry, Role.University)
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.diplomas.history(id);
  }

  /** Téléchargement du PDF déchiffré (Université, Ministère, ou étudiant propriétaire). */
  @Get(':id/document')
  @Roles(Role.University, Role.Ministry, Role.Student)
  async document(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const pdf = await this.diplomas.downloadDocument(id, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="diplome-${id}.pdf"`,
    });
  }

  /** Justificatif Open Badges 3.0 (JSON-LD, non signé). */
  @Get(':id/credential')
  @Roles(Role.University, Role.Ministry, Role.Student)
  credential(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.diplomas.credential(id, user);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @Roles(Role.University, Role.Ministry)
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokeDiplomaDto, @CurrentUser() user: AuthUser) {
    return this.diplomas.revoke(id, dto, user);
  }

  /** Génère un lien de partage à durée limitée (Étudiant). */
  @Post(':id/share')
  @HttpCode(200)
  @Roles(Role.Student)
  share(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareDiplomaDto, @CurrentUser() user: AuthUser) {
    return this.diplomas.share(id, dto.ttlMinutes, user);
  }
}
