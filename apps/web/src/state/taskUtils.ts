import { AppError, isAbortAppError, toAppError } from '../api/errors.js';

type WaitFn = (ms: number) => Promise<void>;

export type TaskOutcome<T> =
  { status: 'success'; data: T } | { status: 'aborted' } | { status: 'error'; error: AppError };

type RetryOptions = {
  attempts?: number;
  initialDelayMs?: number;
  waitFn?: WaitFn;
  shouldRetry?: (error: AppError, attempt: number) => boolean;
};

const waitDefault: WaitFn = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const runTask = async <T>(task: () => Promise<T>): Promise<TaskOutcome<T>> => {
  try {
    const data = await task();
    return { status: 'success', data };
  } catch (error) {
    const normalized = toAppError(error);
    if (isAbortAppError(normalized)) return { status: 'aborted' };
    return { status: 'error', error: normalized };
  }
};

export const withRetry = async <T>(
  task: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const attempts = Math.max(1, options.attempts ?? 2);
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? 120);
  const wait = options.waitFn ?? waitDefault;
  const shouldRetry =
    options.shouldRetry ??
    ((error: AppError) => {
      return error.retriable && !isAbortAppError(error);
    });

  let currentDelayMs = initialDelayMs;
  let attempt = 1;

  while (attempt <= attempts) {
    try {
      return await task();
    } catch (error) {
      const normalized = toAppError(error);
      const lastAttempt = attempt >= attempts;
      if (lastAttempt || !shouldRetry(normalized, attempt)) {
        throw normalized;
      }
      await wait(currentDelayMs);
      currentDelayMs = currentDelayMs * 2;
      attempt += 1;
    }
  }

  throw new AppError({
    kind: 'unknown',
    code: 'RETRY_EXHAUSTED',
    message: 'Retry attempts exhausted.',
    retriable: false,
  });
};
