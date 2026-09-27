// Cancelling a vscode-jsonrpc `CancellationToken` passed to
// `MessageConnection#sendRequest` sends `$/cancelRequest` to the server, but
// the server isn't required to honor it, so a superseded call's promise must
// settle immediately instead of waiting for the underlying work to finish.
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
  err.name = 'AbortError'
  return err
}

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
