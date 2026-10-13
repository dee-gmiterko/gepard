import type { IpcErrorShape } from '../ipc/contract';
import { errorMessage } from '../helpers/error';
import { AbortError } from './AbortError';
import { AppError } from './AppError';
import { AuthError } from './AuthError';
import { ConnectionError } from './ConnectionError';
import { IpcError } from './IpcError';
import { MissingDependencyError } from './MissingDependencyError';
import { RateLimitError } from './RateLimitError';
import { RemoteNotFoundError } from './RemoteNotFoundError';
import { StaleShaError } from './StaleShaError';

type Rebuild = (shape: IpcErrorShape) => AppError | undefined;

const rebuildWith =
  (Kind: new (message: string, details?: unknown) => AppError): Rebuild =>
  (shape) =>
    new Kind(shape.message, shape.details);

const kinds = new Map<string, Rebuild>([
  ['AbortError', rebuildWith(AbortError)],
  ['AuthError', rebuildWith(AuthError)],
  ['ConnectionError', rebuildWith(ConnectionError)],
  ['MissingDependencyError', (shape) => MissingDependencyError.fromShape(shape)],
  ['RateLimitError', rebuildWith(RateLimitError)],
  ['RemoteNotFoundError', rebuildWith(RemoteNotFoundError)],
  ['StaleShaError', rebuildWith(StaleShaError)],
]);

// Extensions bundle their own copy of this package, so their errors fail `instanceof`.
function isAppErrorOfKnownKind(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    kinds.has(error.name) &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

export function toIpcErrorShape(error: unknown): IpcErrorShape {
  if (error instanceof AppError || isAppErrorOfKnownKind(error))
    return { kind: error.name, code: error.code, message: error.message, details: error.details };
  if (error instanceof Error && error.name === 'AbortError')
    return { kind: error.name, code: 'CANCELLED', message: error.message };
  return { code: 'INTERNAL', message: errorMessage(error) };
}

export function fromIpcErrorShape(shape: IpcErrorShape, channel: string): AppError {
  const rebuild = shape.kind === undefined ? undefined : kinds.get(shape.kind);
  const error = rebuild?.(shape) ?? new IpcError(shape);
  error.channel = channel;
  return error;
}
