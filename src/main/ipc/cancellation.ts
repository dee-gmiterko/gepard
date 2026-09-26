// Latest-wins cancellation for in-flight per-keystroke/per-anchor requests
// (coordinator spec: `search.run`, `symbols.workspace`, `symbols.line`,
// `symbols.definition` pile up ripgrep processes and queue LSP requests
// today). A new request registered under the same key cancels the previous
// in-flight one immediately:
//  - ripgrep: the `AbortSignal` handed to `run`/`spawnCollect`/`ripgrepSearch`
//    (exec.ts already maps a Node `AbortError` to the `CANCELLED` IPC error,
//    report 04 §2.4/§3.1).
//  - LSP: the vscode-jsonrpc `CancellationToken` handed to
//    `MessageConnection#sendRequest`, which sends `$/cancelRequest` to the
//    server (report 03 §4).
//
// The superseded call's promise settles with a `CANCELLED`-shaped error the
// instant it is superseded, independent of whether the underlying work
// (a language server that ignores cancellation, a ripgrep kill that takes a
// moment) ever actually finishes — callers must not be left hanging on a
// server that never honors `$/cancelRequest`.
import { CancellationTokenSource, type CancellationToken } from 'vscode-jsonrpc'

export interface CancellableRun {
  signal: AbortSignal
  token: CancellationToken
}

interface Entry {
  controller: AbortController
  cts: CancellationTokenSource
}

const inFlight = new Map<string, Entry>()

function cancelledError(): Error {
  const err = new Error('Cancelled: superseded by a newer request')
  err.name = 'AbortError' // mapped to the CANCELLED IPC error code by ipc/registry.ts
  return err
}

/** Runs `fn` under latest-wins cancellation for `key`. Any previous in-flight
 * call under the same key is cancelled (its `AbortSignal` aborted, its
 * `CancellationToken` cancelled) and its promise rejects right away with a
 * `CANCELLED` error; `fn` receives a fresh signal/token for this call. */
export function withLatestWins<T>(
  key: string,
  fn: (run: CancellableRun) => Promise<T>
): Promise<T> {
  const previous = inFlight.get(key)
  previous?.controller.abort()
  previous?.cts.cancel()

  const controller = new AbortController()
  const cts = new CancellationTokenSource()
  const entry: Entry = { controller, cts }
  inFlight.set(key, entry)

  function settle(): void {
    if (inFlight.get(key) === entry) inFlight.delete(key)
    cts.dispose()
  }

  // Races the real work against this call's own cancellation, so a superseded
  // call resolves immediately instead of waiting on `fn` (which may itself be
  // waiting on a language server that never responds to `$/cancelRequest`).
  const cancellation = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(cancelledError()), { once: true })
  })

  return Promise.race([fn({ signal: controller.signal, token: cts.token }), cancellation]).then(
    (result) => {
      settle()
      return result
    },
    (e: unknown) => {
      settle()
      throw e
    }
  )
}
