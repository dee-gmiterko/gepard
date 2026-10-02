// Cancelling a vscode-jsonrpc `CancellationToken` sends `$/cancelRequest`,
// which the server is not required to honor.
import { CancellationTokenSource, type CancellationToken } from 'vscode-jsonrpc';
import { AbortError } from '@gepard/common';

export interface CancellableRun {
  signal: AbortSignal;
  token: CancellationToken;
}

interface Entry {
  controller: AbortController;
  cts: CancellationTokenSource;
}

const inFlight = new Map<string, Entry>();

export function withLatestWins<T>(
  key: string,
  fn: (run: CancellableRun) => Promise<T>,
): Promise<T> {
  const previous = inFlight.get(key);
  previous?.controller.abort();
  previous?.cts.cancel();

  const controller = new AbortController();
  const cts = new CancellationTokenSource();
  const entry: Entry = { controller, cts };
  inFlight.set(key, entry);

  function settle(): void {
    if (inFlight.get(key) === entry) inFlight.delete(key);
    cts.dispose();
  }

  const cancellation = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(new AbortError('Cancelled: superseded by a newer request')),
      { once: true },
    );
  });

  return Promise.race([fn({ signal: controller.signal, token: cts.token }), cancellation]).then(
    (result) => {
      settle();
      return result;
    },
    (e: unknown) => {
      settle();
      throw e;
    },
  );
}
