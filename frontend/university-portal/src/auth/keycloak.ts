import Keycloak from 'keycloak-js';
import { config } from '../config';

export const keycloak = new Keycloak({
  url: config.keycloak.url,
  realm: config.keycloak.realm,
  clientId: config.keycloak.clientId,
});

interface InitResult {
  authenticated: boolean;
  failed: boolean;
}

interface InitResult {
  authenticated: boolean;
  failed: boolean;
}

let initPromise: Promise<InitResult> | undefined;

/** Initialise Keycloak une seule fois (Authorization Code + PKCE S256, SSO silencieux). */
export function initAuth(): Promise<InitResult> {
  const promise: Promise<InitResult> =
    initPromise ??
    keycloak
      .init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      })
      .then((authenticated: boolean): InitResult => ({ authenticated, failed: false }))
      .catch((): InitResult => ({ authenticated: false, failed: true }));
  initPromise = promise;
  return promise;
}

/** Jeton d'accès valide (renouvelé si besoin) ou undefined si l'utilisateur n'est pas connecté. */
export async function getAccessToken(): Promise<string | undefined> {
  if (!keycloak.authenticated) return undefined;
  try {
    await keycloak.updateToken(30);
  } catch {
    await keycloak.login();
    return undefined;
  }
  return keycloak.token;
}

export function forceLogin() {
  return keycloak.login({ redirectUri: window.location.href });
}
