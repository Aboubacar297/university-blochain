import { ApiError } from '../api/client';
import type { TFunction } from '../i18n';

/** Message lisible pour l'utilisateur : ce qui s'est passé et comment poursuivre. */
export function describeError(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:
        return t('error.network');
      case 400:
        return err.details?.length ? err.details.join(' ') : t('error.400');
      case 401:
        return t('error.401');
      case 403:
        return t('error.403');
      case 404:
        return t('error.404');
      case 409:
        return t('error.409');
      case 422:
        return t('error.422');
      case 429:
        return t('error.429');
      case 413:
        return t('error.413');
      default:
        return err.status >= 500 ? t('error.5xx') : t('error.generic');
    }
  }
  return t('error.generic');
}

export const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;
export const isForbidden = (err: unknown) => err instanceof ApiError && err.status === 403;
