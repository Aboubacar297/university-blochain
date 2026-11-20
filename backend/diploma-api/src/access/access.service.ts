import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { AuthUser } from '../auth/auth.types';
import { isRealPastDate, normalizeText, splitName } from '../common/normalize';
import { AccountRecord, StoreService } from '../common/store.service';
import { AccessConfig } from '../config/configuration';
import { DiplomasService } from '../diplomas/diplomas.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { RequestAccessDto } from './dto/request-access.dto';
import { TurnstileService } from './turnstile.service';

export interface AccessGrant {
  username: string;
  temporaryPassword: string;
  expiresAt: string;
  mode: 'created' | 'regenerated';
}

export interface AccessStatus {
  managed: boolean;
  status?: 'ACTIVE' | 'EXPIRED';
  grantedAt?: string;
  expiresAt?: string;
  daysLeft?: number;
}

const DAY_MS = 86_400_000;
const GENERIC_MISMATCH =
  'Les informations saisies ne correspondent à aucun diplôme enregistré. Vérifiez-les ou contactez le service de scolarité.';

const PASSWORD_SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#$%&*+-=?@'];

function generatePassword(length = 16): string {
  const chars = PASSWORD_SETS.map((set) => set[randomInt(set.length)]);
  const all = PASSWORD_SETS.join('');
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);
  private readonly windowDays: number;

  constructor(
    private readonly diplomas: DiplomasService,
    private readonly keycloak: KeycloakAdminService,
    private readonly turnstile: TurnstileService,
    private readonly store: StoreService,
    config: ConfigService,
  ) {
    this.windowDays = config.getOrThrow<AccessConfig>('access').windowDays;
  }

  /**
   * Création ou régénération de l'accès étudiant (valable `windowDays` jours) après vérification de l'identité
   * par recoupement avec les données saisies à l'émission du diplôme.
   */
  async request(dto: RequestAccessDto, remoteIp?: string): Promise<AccessGrant> {
    // 1) Champ piège : un robot le remplit. Réponse identique à un échec de vérification, après un court délai.
    if (dto.website && dto.website.trim() !== '') {
      await new Promise((resolve) => setTimeout(resolve, 800 + randomInt(600)));
      throw new UnprocessableEntityException(GENERIC_MISMATCH);
    }

    // 2) Contrôle anti-robot (Cloudflare Turnstile), vérifié côté serveur
    if (!(await this.turnstile.verify(dto.turnstileToken, remoteIp))) {
      throw new BadRequestException('Le contrôle anti-robot a échoué. Rechargez la page et réessayez.');
    }
    if (!this.keycloak.configured) throw new ServiceUnavailableException("La gestion des accès n'est pas configurée.");

    // 3) Validation stricte des données
    const errors: string[] = [];
    if (!isRealPastDate(dto.birthDate)) errors.push('La date de naissance est invalide ou située dans le futur.');
    if (dto.year > new Date().getUTCFullYear() + 1) errors.push("L'année du diplôme est invalide.");
    if (errors.length > 0) throw new BadRequestException(errors);

    // 4) Recoupement avec le registre et les données d'identité chiffrées
    const matched = await this.findMatchingDiploma(dto);
    if (!matched) {
      this.logger.warn(`Demande d'accès refusée pour ${dto.ine.slice(0, 3)}*** (informations non concordantes)`);
      throw new UnprocessableEntityException(GENERIC_MISMATCH);
    }

    // 5) Compte Keycloak : création ou régénération du mot de passe temporaire
    const username = dto.ine;
    const password = generatePassword();
    let user = await this.keycloak.findUser(username);
    let mode: AccessGrant['mode'] = 'regenerated';
    if (!user) {
      const { firstName, lastName } = splitName(dto.fullName);
      const id = await this.keycloak.createUser({ username, email: dto.email, firstName, lastName });
      await this.keycloak.assignRealmRole(id, 'student');
      user = { id, username };
      mode = 'created';
    } else if (user.enabled === false) {
      await this.keycloak.setEnabled(user.id, true);
    }
    await this.keycloak.setTemporaryPassword(user.id, password);

    // 6) Nouvelle fenêtre d'accès
    const now = Date.now();
    const previous = this.store.getAccount(username);
    const record: AccountRecord = {
      username,
      keycloakUserId: user.id,
      grantedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.windowDays * DAY_MS).toISOString(),
      regenerations: (previous?.regenerations ?? 0) + (mode === 'regenerated' ? 1 : 0),
    };
    await this.store.saveAccount(record);
    this.logger.log(`Accès ${mode === 'created' ? 'créé' : 'régénéré'} pour ${username.slice(0, 3)}*** jusqu'au ${record.expiresAt}`);

    return { username, temporaryPassword: password, expiresAt: record.expiresAt, mode };
  }

  /** État du cycle de vie de l'accès de l'étudiant connecté (compte à rebours affiché dans le portail). */
  me(user: AuthUser): AccessStatus {
    const record = this.store.getAccount((user.username ?? '').toUpperCase());
    if (!record) return { managed: false };
    const msLeft = new Date(record.expiresAt).getTime() - Date.now();
    const expired = Boolean(record.lockedAt) || msLeft <= 0;
    return {
      managed: true,
      status: expired ? 'EXPIRED' : 'ACTIVE',
      grantedAt: record.grantedAt,
      expiresAt: record.expiresAt,
      daysLeft: expired ? 0 : Math.ceil(msLeft / DAY_MS),
    };
  }

  /** Verrouille les comptes dont la fenêtre de 30 jours est écoulée (appelée par la tâche planifiée). */
  async lockExpired(): Promise<number> {
    let locked = 0;
    for (const account of this.store.allAccounts()) {
      if (account.lockedAt || new Date(account.expiresAt).getTime() > Date.now()) continue;
      try {
        await this.keycloak.setEnabled(account.keycloakUserId, false);
        await this.keycloak.logout(account.keycloakUserId);
        await this.store.saveAccount({ ...account, lockedAt: new Date().toISOString() });
        locked += 1;
        this.logger.warn(`Accès expiré et verrouillé : ${account.username.slice(0, 3)}***`);
      } catch (err) {
        this.logger.error(`Verrouillage impossible pour ${account.username.slice(0, 3)}*** : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return locked;
  }

  private async findMatchingDiploma(dto: RequestAccessDto) {
    const candidates = (await this.diplomas.listByStudentId(dto.ine)).filter((d) => d.status === 'VALID');
    for (const diploma of candidates) {
      if (normalizeText(diploma.degree) !== normalizeText(dto.degree)) continue;
      const identity = await this.diplomas.identityOf(diploma.diplomaId);
      if (!identity) continue;
      if (
        normalizeText(identity.fullName) === normalizeText(dto.fullName) &&
        identity.birthDate === dto.birthDate &&
        identity.email.toLowerCase() === dto.email &&
        Number(identity.year) === dto.year
      ) {
        return diploma;
      }
    }
    return null;
  }
}
