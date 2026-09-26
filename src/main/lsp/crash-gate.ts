// Per-incarnation crash bookkeeping for LspSession, factored out on its own
// so the two behaviors it drives are pure and unit-testable without spawning
// a real process or a vscode-jsonrpc connection:
//
//  - A request still in flight on a crashed incarnation's connection must
//    reject instead of hanging forever (vscode-jsonrpc never rejects pending
//    requests on its own when the underlying stream closes) — `guard` races
//    the real request against a promise this gate rejects on `crash()`.
//  - A single crash must be logged/toasted exactly once, even though a
//    child process's 'error' and 'exit' events are not mutually exclusive
//    (Node does not guarantee only one fires for a given failure) — `crash()`
//    reports true only the first time it is called for the current
//    incarnation.
//
// `reset()` starts a fresh incarnation (the initial launch, and again after
// each restart), independent of any previous one.
//
// A rejected request always rejects with the same `AbortError`-named shape
// `ipc/cancellation.ts` uses for a request superseded under latest-wins:
// `ipc/registry.ts` maps it to the `CANCELLED` IPC code, so the renderer's
// `reportQueryError` (errors/report.ts) treats it as "not a failure" and
// skips reporting it — the crash itself is already reported once, via the
// sink (`notifyMainFailure`), so an extra toast per pending query would only
// be noise on top of that. The request still rejects instead of hanging
// forever, so its query fails and its caller unblocks.
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

  /** Starts a fresh incarnation: clears the "already logged" flag and gives
   * `guard` a new, not-yet-rejected promise to race requests against. */
  reset(): void {
    this.logged = false
    this.pending = new Promise<never>((_, reject) => {
      this.rejectPending = () => reject(abandonedRequestError())
    })
    // Nothing may ever race this (a crash with no request in flight at the
    // time), which would otherwise surface as an unrelated unhandledRejection.
    this.pending.catch(() => {})
  }

  /** Races `work` against this incarnation's crash: resolves/rejects exactly
   * like `work` unless `crash()` is called first, in which case it rejects
   * with the abandoned-request error instead. */
  guard<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, this.pending])
  }

  /** Records a crash for the current incarnation: rejects every pending
   * `guard`-ed promise, and returns whether this is the first report of it —
   * callers should log/toast only when this is true. */
  crash(): boolean {
    this.rejectPending?.()
    if (this.logged) return false
    this.logged = true
    return true
  }
}
