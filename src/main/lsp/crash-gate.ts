// vscode-jsonrpc never rejects pending requests on its own when the
// underlying stream closes, and a child process's 'error' and 'exit' events
// are not mutually exclusive (Node does not guarantee only one fires for a
// given failure).
function abandonedRequestError(): Error {
  const err = new Error('LSP session crashed; request abandoned')
  err.name = 'AbortError'
  return err
}

export class CrashGate {
  private logged = false
  private rejectPending: (() => void) | null = null
  private pending!: Promise<never>

  constructor() {
    this.reset()
  }

  reset(): void {
    this.logged = false
    this.pending = new Promise<never>((_, reject) => {
      this.rejectPending = () => reject(abandonedRequestError())
    })
    // Nothing may ever await this promise (a crash with no request in
    // flight), which would otherwise surface as an unhandledRejection.
    this.pending.catch(() => {})
  }

  guard<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, this.pending])
  }

  crash(): boolean {
    this.rejectPending?.()
    if (this.logged) return false
    this.logged = true
    return true
  }
}
