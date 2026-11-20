import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { KeycloakConfig } from '../config/configuration';
import { AuthRequest } from './auth.types';

/**
 * Vérifie le jeton d'accès Keycloak (JWT signé RS256) à l'aide du JWKS du realm,
 * puis alimente `request.user` (sub, rôles, student_id).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audience?: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: ConfigService) {
    const k = config.getOrThrow<KeycloakConfig>('keycloak');
    this.issuer = k.issuer;
    this.audience = k.audience;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/protocol/openid-connect/certs`));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Jeton manquant.');
    }

    try {
      const { payload } = await jwtVerify(header.slice(7), this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      });
      req.user = {
        sub: String(payload.sub),
        username: payload['preferred_username'] as string | undefined,
        roles: this.extractRoles(payload),
        studentId: payload['student_id'] as string | undefined,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré.');
    }
  }

  private extractRoles(payload: JWTPayload): string[] {
    const realm = (payload['realm_access'] as { roles?: string[] } | undefined)?.roles ?? [];
    const resources = (payload['resource_access'] as Record<string, { roles?: string[] }> | undefined) ?? {};
    const client = Object.values(resources).flatMap((r) => r.roles ?? []);
    return Array.from(new Set([...realm, ...client]));
  }
}
