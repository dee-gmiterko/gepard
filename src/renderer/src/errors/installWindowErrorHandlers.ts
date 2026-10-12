import { AbortError } from '@gepard/common';
import { reportError } from './report';

export function installWindowErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    reportError({
      scope: 'window',
      message: event.error instanceof Error ? event.error.message : event.message,
      detail: event.error instanceof Error ? event.error.stack : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason instanceof AbortError) return;
    const reason: unknown = event.reason;
    reportError({
      scope: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      detail: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
