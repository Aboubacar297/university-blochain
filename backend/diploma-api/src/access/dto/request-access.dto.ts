import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { INE_PATTERN, NAME_PATTERN } from '../../common/normalize';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Demande d'authentification en ligne d'un étudiant (création ou régénération de l'accès de 30 jours). */
export class RequestAccessDto {
  @Transform(trim)
  @Matches(NAME_PATTERN, { message: 'Le nom complet est invalide (lettres, espaces, apostrophes et tirets uniquement).' })
  fullName: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de naissance doit respecter le format AAAA-MM-JJ.' })
  birthDate: string;

  @Transform(upper)
  @Matches(INE_PATTERN, { message: "L'identifiant unique doit contenir 9 à 12 caractères alphanumériques (INE, CNE ou Massar)." })
  ine: string;

  @Transform(lower)
  @IsEmail({}, { message: "L'adresse e-mail est invalide." })
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "L'intitulé du diplôme est obligatoire." })
  @MaxLength(200)
  degree: string;

  @Type(() => Number)
  @IsInt({ message: "L'année doit être un nombre entier." })
  @Min(1950, { message: "L'année doit être postérieure à 1950." })
  @Max(2100, { message: "L'année est invalide." })
  year: number;

  /** Jeton Cloudflare Turnstile (vérifié côté serveur). */
  @IsString()
  @IsNotEmpty({ message: 'Le contrôle anti-robot est obligatoire.' })
  @MaxLength(2048)
  turnstileToken: string;

  /** Champ piège (honeypot) : invisible pour les humains, rempli par les robots. Doit rester vide. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
