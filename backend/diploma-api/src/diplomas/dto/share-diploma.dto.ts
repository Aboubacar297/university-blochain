import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ShareDiplomaDto {
  /** Durée de validité du lien de partage, en minutes (5 min à 7 jours). Défaut : 60. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(10080)
  ttlMinutes?: number;
}
