import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakConfig } from '../config/configuration';

interface KcUser {
  id: string;
  username: string;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Client minimal de l'API d'administration Keycloak (compte de service du backend, jamais exposé au navigateur). */
@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private readonly base: string;
  private readonly tokenUrl: string;
  private readonly clientId?: string;
  private readonly secret?: string;
  private token?: { value: string; expiresAt: number };

  constructor(config: ConfigService) {
    const k = config.getOrThrow<KeycloakConfig>('keycloak');
    this.base = `${k.url}/admin/realms/${k.realm}`;
    this.tokenUrl = `${k.issuer}/protocol/openid-connect/token`;
    this.clientId = k.adminClientId;
    this.secret = k.adminClientSecret;
  }

  get configured(): boolean {
    return Boolean(this.clientId && this.secret);
  }

  private async accessToken(): Promise<string> {
    if (!this.configured) throw new ServiceUnavailableException("La gestion des accès n'est pas configurée.");
    if (this.token && this.token.expiresAt > Date.now() + 15_000) return this.token.value;
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId as string,
        client_secret: this.secret as string,
      }),
    });
    if (!res.ok) {
      this.logger.error(`Jeton de service refusé par Keycloak (HTTP ${res.status})`);
      throw new ServiceUnavailableException("Le service d'authentification est indisponible.");
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.accessToken();
    return fetch(`${this.base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  }

  private fail(action: string, res: Response): never {
    this.logger.error(`Keycloak : échec de « ${action} » (HTTP ${res.status})`);
    throw new ServiceUnavailableException("Le service d'authentification est indisponible.");
  }

  async findUser(username: string): Promise<KcUser | null> {
    const res = await this.call(`/users?username=${encodeURIComponent(username)}&exact=true`);
    if (!res.ok) this.fail('recherche utilisateur', res);
    const users = (await res.json()) as KcUser[];
    return users[0] ?? null;
  }

  async createUser(user: { username: string; email: string; firstName: string; lastName: string }): Promise<string> {
    const res = await this.call('/users', {
      method: 'POST',
      body: JSON.stringify({ ...user, enabled: true, emailVerified: false }),
    });
    if (res.status !== 201) this.fail('création utilisateur', res);
    const id = res.headers.get('location')?.split('/').pop();
    if (!id) this.fail('création utilisateur (identifiant manquant)', res);
    return id as string;
  }

  /** Mot de passe temporaire : Keycloak impose son changement à la première connexion. */
  async setTemporaryPassword(id: string, password: string): Promise<void> {
    const res = await this.call(`/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: password, temporary: true }),
    });
    if (res.status !== 204) this.fail('définition du mot de passe', res);
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const get = await this.call(`/users/${id}`);
    if (!get.ok) this.fail('lecture utilisateur', get);
    const user = (await get.json()) as KcUser;
    const put = await this.call(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ ...user, enabled }) });
    if (put.status !== 204) this.fail('mise à jour utilisateur', put);
  }

  async logout(id: string): Promise<void> {
    const res = await this.call(`/users/${id}/logout`, { method: 'POST' });
    if (!res.ok && res.status !== 404) this.fail('fermeture des sessions', res);
  }

  async assignRealmRole(id: string, roleName: string): Promise<void> {
    const roleRes = await this.call(`/roles/${encodeURIComponent(roleName)}`);
    if (!roleRes.ok) this.fail('lecture du rôle', roleRes);
    const role = await roleRes.json();
    const res = await this.call(`/users/${id}/role-mappings/realm`, { method: 'POST', body: JSON.stringify([role]) });
    if (res.status !== 204) this.fail("attribution du rôle", res);
  }
}
