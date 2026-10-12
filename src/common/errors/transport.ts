import type { IpcErrorShape } from '../ipc/contract';
import { errorMessage } from '../helpers/error';
import { AbortError } from './AbortError';
import { AppError } from './AppError';
import { AuthError } from './AuthError';
import { ConnectionError } from './ConnectionError';
import { IpcError } from './IpcError';
import { RateLimitError } from './RateLimitError';
import { RemoteNotFoundError } from './RemoteNotFoundError';
import { StaleShaError } from './StaleShaError';

type Rebuild = new (message: string, details?: unknown) => AppError;

const kinds = new Map<string, Rebuild>(
  Object.entries({
    AbortError,
    AuthError,
    ConnectionError,
    RateLimitError,
    RemoteNotFoundError,
    StaleShaError,
  }),
);

// Node's own AbortError (an aborted child process) is not an AppError.
export function toIpcErrorShape(error: unknown): IpcErrorShape {
  if (error instanceof AppError)
    return { kind: error.name, code: error.code, message: error.message, details: error.details };
  if (error instanceof Error && error.name === 'AbortError')
    return { kind: error.name, code: 'CANCELLED', message: error.message };
  return { code: 'INTERNAL', message: errorMessage(error) };
}

export function fromIpcErrorShape(shape: IpcErrorShape, channel: string): AppError {
  const Kind = shape.kind === undefined ? undefined : kinds.get(shape.kind);
  const error = Kind ? new Kind(shape.message, shape.details) : new IpcError(shape);
  error.channel = channel;
  return error;
}
