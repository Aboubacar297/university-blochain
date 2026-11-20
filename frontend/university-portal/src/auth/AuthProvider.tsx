import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '../types';
import { initAuth, keycloak } from './keycloak';

export const ROLE_ORDER: Role[] = ['university', 'ministry', 'recruiter', 'student'];

export interface AuthUser {
  name: string;
  username: string;
  roles: Role[];
  studentId?: string;
}

interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  unavailable: boolean;
  user: AuthUser | null;
  hasRole: (...roles: Role[]) => boolean;
  login: (redirectPath?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface TokenClaims {
  name?: string;
  preferred_username?: string;
  student_id?: string;
  realm_access?: { roles?: string[] };
}

function readUser(): AuthUser | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) return null;
  const claims = keycloak.tokenParsed as TokenClaims;
  const all = claims.realm_access?.roles ?? [];
  const roles = ROLE_ORDER.filter((r) => all.includes(r));
  const username = claims.preferred_username ?? '';
  return { name: claims.name ?? username, username, roles, studentId: claims.student_id };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let alive = true;
    initAuth().then(({ failed }) => {
      if (!alive) return;
      setUnavailable(failed);
      setUser(readUser());
      setReady(true);
    });
    keycloak.onAuthRefreshSuccess = () => setUser(readUser());
    keycloak.onAuthLogout = () => setUser(null);
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => setUser(null));
    };
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback((redirectPath?: string) => {
    const target = redirectPath ?? window.location.pathname + window.location.search;
    void keycloak.login({ redirectUri: window.location.origin + target });
  }, []);

  const logout = useCallback(() => {
    void keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      authenticated: user !== null,
      unavailable,
      user,
      hasRole: (...roles: Role[]) => !!user && roles.some((r) => user.roles.includes(r)),
      login,
      logout,
    }),
    [ready, user, unavailable, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

/** Page d'accueil selon le rôle principal. */
export function homeFor(roles: Role[]): string {
  if (roles.includes('university')) return '/issue';
  if (roles.includes('ministry')) return '/dashboard';
  if (roles.includes('recruiter')) return '/verify';
  if (roles.includes('student')) return '/my-diplomas';
  return '/';
}
