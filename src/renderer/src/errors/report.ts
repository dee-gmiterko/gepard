import { IpcError } from '@gepard/common';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import { z } from 'zod';
import { invoke, isCancelledError, isConnectionError, isStaleShaError } from '../ipc/client';
import { describeError, errorText } from './errorMessage';

const messages = defineMessages({
  connectionFailed: {
    id: 'errors.connectionFailed',
    defaultMessage: 'GitHub could not be reached. Check your connection and try again.',
  },
});

export const ReportTone = z.enum(['danger', 'warning']);
export type ReportTone = z.infer<typeof ReportTone>;

export interface ReportedError {
  scope: string;
  message: string | MessageDescriptor;
  tone?: ReportTone;
  detail?: string;
  loggedByMain?: boolean;
}

type Listener = (error: ReportedError) => void;
const listeners = new Set<Listener>();

export function onReportedError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportError(error: ReportedError): void {
  for (const listener of listeners) listener(error);
  if (error.loggedByMain) return;

  const headline = errorText(error.message);
  const message = error.detail ? `${headline}\n${error.detail}` : headline;
  invoke('log.write', {
    level: error.tone === 'warning' ? 'warn' : 'error',
    scope: error.scope,
    message,
  }).catch(() => {});
}

export interface ReportQueryErrorOptions {
  explicit?: boolean;
}

// Background connection failures surface only through the header's offline indicator.
export function reportQueryError(
  scope: string,
  error: unknown,
  { explicit = false }: ReportQueryErrorOptions = {},
): void {
  if (isCancelledError(error) || isStaleShaError(error)) return;
  if (isConnectionError(error)) {
    if (explicit) reportConnectionError(scope, error);
    return;
  }
  const { message, detail } = describeError(error);
  reportError({ scope, message, detail: mergeDetail(detail, errorDetail(error)) });
}

function reportConnectionError(scope: string, error: unknown): void {
  reportError({
    scope,
    message: messages.connectionFailed,
    detail: mergeDetail(error instanceof IpcError ? error.message : undefined, errorDetail(error)),
  });
}

function mergeDetail(primary: string | undefined, extra: string | undefined): string | undefined {
  return [primary, extra].filter(Boolean).join('\n') || undefined;
}

function errorDetail(error: unknown): string | undefined {
  if (error instanceof IpcError) {
    const parts = [`channel=${error.channel ?? '?'} code=${error.code}`];
    if (error.details !== undefined) {
      try {
        parts.push(`details=${JSON.stringify(error.details)}`);
      } catch {
        parts.push('details=[unserializable]');
      }
    }
    return parts.join(' ');
  }
  return error instanceof Error ? error.stack : undefined;
}
