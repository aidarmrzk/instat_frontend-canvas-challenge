export type AppErrorKind = 'network' | 'http' | 'parse' | 'unknown';

export class AppError extends Error {
  kind: AppErrorKind;
  code: string;
  retriable: boolean;
  status: number | null;

  constructor(args: {
    kind: AppErrorKind;
    message: string;
    code?: string;
    retriable?: boolean;
    status?: number | null;
  }) {
    super(args.message);
    this.name = 'AppError';
    this.kind = args.kind;
    this.code = args.code ?? 'UNKNOWN_ERROR';
    this.retriable = args.retriable ?? false;
    this.status = args.status ?? null;
  }
}

export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppError({
      kind: 'network',
      message: 'Request was cancelled.',
      code: 'REQUEST_ABORTED',
      retriable: true,
    });
  }
  if (error instanceof TypeError) {
    return new AppError({
      kind: 'network',
      message: 'Network request failed.',
      code: 'NETWORK_FAILED',
      retriable: true,
    });
  }
  return new AppError({
    kind: 'unknown',
    message: 'Unexpected error.',
    code: 'UNKNOWN_ERROR',
    retriable: false,
  });
};

export const isAbortAppError = (error: AppError): boolean => error.code === 'REQUEST_ABORTED';
