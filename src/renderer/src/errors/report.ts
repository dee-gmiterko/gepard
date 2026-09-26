// Every failure in the renderer funnels through reportError(): it is always
// forwarded to main's log file (report 04 "log.ts": a failure in the
// packaged app must be readable afterwards) and always surfaced once as a
// toast over the shared AppContext — state/ToastHost.tsx is the sole
// subscriber and is what actually renders it (coordinator spec: "one
// unified toast surface over the shared app context").
//
// A `CANCELLED` IPC result is a request superseded by a newer one under
// main's latest-wins cancellation (ipc/client.ts#isCancelledError) — not a
// failure. Callers that might see one must filter it out before reporting;
// reportQueryError below does this for every TanStack Query/mutation error.
import { invoke, IpcError, isCancelledError } from '../ipc/client'
import { errorMessage } from '../components/Message'

export type ReportTone = 'danger' | 'warning'

export interface ReportedError {
  /** Where the failure came from (a query hash, mutation key, 'render',
   * 'window', …) — goes to the log line only, never shown to the user. */
  scope: string
  message: string
  tone?: ReportTone
  /** Extra detail for the log file only (stack, componentStack, IpcError.details). */
  detail?: string
  /** Set when main already wrote this failure to the log itself (a failure
   * main pushes as domain data: `clone.progress` 'error', `index.status`
   * 'error'); it is then only toasted here, so it is logged exactly once. */
  loggedByMain?: boolean
}

type Listener = (error: ReportedError) => void
const listeners = new Set<Listener>()

/** ToastHost (mounted once, inside AppProvider) is the only intended
 * subscriber; it turns each report into an AppContext `toast/push`. */
export function onReportedError(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The one function every failure path in the renderer calls. Never throws:
 * logging must never itself become a source of unhandled failures. */
export function reportError(error: ReportedError): void {
  for (const listener of listeners) listener(error)
  if (error.loggedByMain) return

  const message = error.detail ? `${error.message}\n${error.detail}` : error.message
  invoke('log.write', {
    level: error.tone === 'warning' ? 'warn' : 'error',
    scope: error.scope,
    message
  }).catch(() => {
    // The IPC bridge itself is unreachable; there is nowhere left to report to.
  })
}

/** Failed query/mutation -> a report, unless it is a superseded `CANCELLED`
 * result, which is not a failure (see file header). Used by the global
 * QueryCache/MutationCache hooks in main.tsx so no query hook anywhere has to
 * report its own errors. */
export function reportQueryError(scope: string, error: unknown): void {
  if (isCancelledError(error)) return
  reportError({ scope, message: errorMessage(error), detail: errorDetail(error) })
}

/** Log-only context for a failed query/mutation. Main does not log failures
 * it returns over IPC (ipc/registry.ts), so this line is the only record of
 * which channel failed, with what code and details (e.g. an ExecError's
 * cmd/args/exitCode/stderr). */
function errorDetail(error: unknown): string | undefined {
  if (error instanceof IpcError) {
    const parts = [`channel=${error.channel ?? '?'} code=${error.code}`]
    if (error.details !== undefined) {
      try {
        parts.push(`details=${JSON.stringify(error.details)}`)
      } catch {
        parts.push(`details=${String(error.details)}`)
      }
    }
    return parts.join(' ')
  }
  return error instanceof Error ? error.stack : undefined
}
