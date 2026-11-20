import { config } from '../config';
import { forceLogin, getAccessToken } from '../auth/keycloak';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: FormData;
  json?: unknown;
  auth?: boolean;
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  let details: string[] | undefined;
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      details = data.message;
      message = data.message.join(' ');
    } else if (typeof data.message === 'string') {
      message = data.message;
    }
  } catch {
    /* réponse sans corps JSON */
  }
  return new ApiError(res.status, message, details);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  let body: BodyInit | undefined = options.body;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }
  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, { method: options.method ?? 'GET', headers, body });
  } catch {
    throw new ApiError(0, 'network');
  }

  if (res.status === 401 && options.auth !== false) {
    void forceLogin();
  }
  if (!res.ok) throw await toApiError(res);

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return (await res.json()) as T;
  return (await res.blob()) as unknown as T;
}
