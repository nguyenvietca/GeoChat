import { buildApiUrl, API_TIMEOUT_MS } from '../config/api';
import { ApiEnvelope } from '../types/auth';

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unprocessable_entity'
  | 'server'
  | 'http'
  | 'network'
  | 'timeout'
  | 'invalid_response';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly status?: number,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const statusDetails: Record<number, { code: ApiErrorCode; message: string }> = {
  400: { code: 'bad_request', message: 'Please check the information and try again.' },
  401: { code: 'unauthorized', message: 'Your login details are invalid or your session has expired.' },
  403: { code: 'forbidden', message: 'You do not have permission to do that.' },
  404: { code: 'not_found', message: 'The requested item could not be found.' },
  409: { code: 'conflict', message: 'This account already exists.' },
  422: { code: 'unprocessable_entity', message: 'Please review the information and try again.' },
  500: { code: 'server', message: 'The server encountered a problem. Please try again.' },
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(path), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    let payload: ApiEnvelope<T> | null = null;
    const responseBody = await response.text();
    if (responseBody) {
      try {
        payload = JSON.parse(responseBody) as ApiEnvelope<T>;
      } catch (error) {
        if (response.ok) {
          throw new ApiError('The server returned an invalid response.', 'invalid_response', response.status, error);
        }
      }
    }

    if (!response.ok || payload?.success === false) {
      const details = statusDetails[response.status] ?? { code: 'http' as const, message: 'The request could not be completed.' };
      const serverMessage = typeof payload?.message === 'string' ? payload.message.trim() : '';
      throw new ApiError(serverMessage || details.message, details.code, response.status);
    }

    if (!payload) {
      throw new ApiError('The server returned an empty response.', 'invalid_response', response.status);
    }

    return payload.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      timedOut ? 'The request timed out. Please try again.' : 'Unable to connect. Check your connection and try again.',
      timedOut ? 'timeout' : 'network',
      undefined,
      error,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
