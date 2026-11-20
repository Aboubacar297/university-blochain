import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { INE_PATTERN, NAME_PATTERN } from '../../common/normalize';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class CreateDiplomaDto {
  /** Identifiant unique de l'étudiant (INE / CNE / Massar). Jamais écrit en clair dans la blockchain. */
  @Transform(upper)
  @Matches(INE_PATTERN, { message: "L'identifiant étudiant doit contenir 9 à 12 caractères alphanumériques (INE, CNE ou Massar)." })
  studentId: string;

  @Transform(trim)
  @Matches(NAME_PATTERN, { message: 'Le nom complet est invalide (lettres, espaces, apostrophes et tirets uniquement).' })
  fullName: string;

  @IsISO8601({ strict: true }, { message: 'La date de naissance doit être une date valide (AAAA-MM-JJ).' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de naissance doit respecter le format AAAA-MM-JJ.' })
  birthDate: string;

  @Transform(lower)
  @IsEmail({}, { message: "L'adresse e-mail est invalide." })
  @MaxLength(254)
  email: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200)
  institution: string;

  @Transform(trim) @IsString() @IsNotEmpty({ message: "L'intitulé du diplôme est obligatoire." }) @MaxLength(200)
  degree: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(200)
  major?: string;

  /** Année d'obtention du diplôme. */
  @Type(() => Number)
  @IsInt({ message: "L'année doit être un nombre entier." })
  @Min(1950, { message: "L'année doit être postérieure à 1950." })
  @Max(2100, { message: "L'année est invalide." })
  year: number;

  /** Date d'émission au format ISO 8601 (ex. 2026-07-15). */
  @IsISO8601({ strict: true }, { message: "La date d'émission doit être une date valide (AAAA-MM-JJ)." })
  issueDate: string;
}
