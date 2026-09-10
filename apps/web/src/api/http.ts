import { AppError, toAppError } from './errors.js';
import type { RequestMeta } from '../types.js';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4001';

const parseRetryAfterMs = (value: string | null): number | null => {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.round(numeric * 1000);
  return null;
};

const parseErrorBody = async (
  response: Response,
): Promise<{ code: string; message: string } | null> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };
    if (!payload.error?.code || !payload.error?.message) return null;
    return { code: payload.error.code, message: payload.error.message };
  } catch {
    return null;
  }
};

export const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: RequestMeta }> => {
  const method = options.method ?? 'GET';
  const headers = new Headers({
    Accept: 'application/json',
    ...options.headers,
  });
  if (options.body !== undefined) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    throw toAppError(error);
  }

  const meta: RequestMeta = {
    etag: response.headers.get('etag'),
    location: response.headers.get('location'),
    retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
  };

  if (!response.ok) {
    const payload = await parseErrorBody(response);
    throw new AppError({
      kind: 'http',
      status: response.status,
      code: payload?.code ?? `HTTP_${response.status}`,
      message: payload?.message ?? `HTTP request failed with status ${response.status}.`,
      retriable: response.status >= 500,
    });
  }

  if (response.status === 204) {
    return { data: null as T, meta };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new AppError({
      kind: 'parse',
      status: response.status,
      code: 'UNEXPECTED_CONTENT_TYPE',
      message: 'Expected JSON response body.',
      retriable: false,
    });
  }

  try {
    const data = (await response.json()) as T;
    return { data, meta };
  } catch {
    throw new AppError({
      kind: 'parse',
      status: response.status,
      code: 'JSON_PARSE_FAILED',
      message: 'Unable to parse response body.',
      retriable: false,
    });
  }
};
