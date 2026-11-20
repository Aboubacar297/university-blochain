import { IsUUID } from 'class-validator';

export class VerifyDiplomaDto {
  @IsUUID()
  diplomaId: string;
}
