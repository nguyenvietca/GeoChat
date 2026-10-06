export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message: string;
};

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
};

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Unable to connect. Check your network and try again.');
  }

  let payload: ApiEnvelope<T> | null = null;
  const responseText = await response.text();
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as ApiEnvelope<T>;
    } catch {
      if (response.ok) {
        throw new ApiError('The server returned an invalid response.', response.status);
      }
    }
  }

  if (response.status === 401) {
    unauthorizedHandler?.();
  }
  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'The request could not be completed. Please try again.',
      response.status,
    );
  }
  if (!payload) {
    throw new ApiError('The server returned an empty response.', response.status);
  }

  return payload.data;
}