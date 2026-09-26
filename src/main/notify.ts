// Bridges main-process failures that are not the result of a renderer
// request to the unified toast surface (coordinator spec: every failure is
// logged once and shown once, over the shared AppContext toast surface).
//
// `log.write` (ipc/handlers/log.ts) already covers renderer-originated
// failures (the renderer toasts itself, then forwards the same failure here
// to log it). A couple of background failures already have their own
// domain-specific channel with its own toast wiring — a failed clone
// (`clone.progress`'s 'error' phase, services/git.ts) and a failed
// language-session start (`index.status`'s 'error' state, lsp/index.ts),
// both toasted by the renderer's app-wide subscriptions in main.tsx — and
// lsp/session.ts reports a process error/exit during a launch only as that
// launch's rejection, never also to the sink — so those keep calling
// `log.error` directly and never go through here; doing otherwise would
// toast the same failure twice.
//
// Everything else that fails outside a request — process-level crashes
// (index.ts), LSP crashes/failed restarts and session teardown failures
// (lsp/index.ts) — has nowhere else to surface, so it goes through
// `notifyMainFailure` to reach the renderer once, via the `app.error` event.
//
// `emit` only reaches windows that exist right now, over a listener the
// renderer has already registered (registry.ts's `webContents.send`) — a
// fire-and-forget push, not a queue. A failure before any window exists
// (e.g. an `uncaughtException` during startup, before `createMainWindow`)
// or before that window's renderer has run its `subscribe('app.error', ...)`
// (main.tsx, early in its module top level) would otherwise be logged here
// and then silently dropped, never toasted. `AppErrorGate` closes that gap:
// every notification is buffered until `markRendererReady` (called from
// index.ts once the window's `did-finish-load` fires, by which point the
// renderer's module-level `subscribe` has already run) says it is safe to
// deliver, and is then flushed exactly once, in order.
import { emit } from './ipc/registry'
import { log } from './log'

export interface AppErrorPayload {
  scope: string
  message: string
}

/** Buffers `app.error` payloads until the renderer is ready to receive them.
 * Pure: no Electron, no globals, so it is unit-testable on its own. */
export class AppErrorGate {
  private ready = false
  private pending: AppErrorPayload[] = []

  /** Records a failure. Returns what to deliver right now: the payload
   * itself, once ready, or nothing (it is buffered instead). */
  notify(payload: AppErrorPayload): AppErrorPayload[] {
    if (this.ready) return [payload]
    this.pending.push(payload)
    return []
  }

  /** Marks the gate ready and returns everything buffered before now, in
   * order, to flush exactly once. Idempotent: once ready, later calls (e.g.
   * a dev-mode reload's second `did-finish-load`) return nothing further. */
  open(): AppErrorPayload[] {
    if (this.ready) return []
    this.ready = true
    return this.pending.splice(0)
  }
}

const appErrorGate = new AppErrorGate()

/** Only 'error'-level sink messages (LSP crashes, failed restarts) are
 * failures worth interrupting the user for; 'warn'/'info' stay log-only, as
 * before. Pure so it is unit-testable without Electron. */
export function isNotifiableLevel(level: 'info' | 'warn' | 'error'): boolean {
  return level === 'error'
}

/** The message logged/shown for an uncaught exception or unhandled
 * rejection, shared by both process-level handlers in index.ts so it is
 * unit-testable without touching real process crash hooks. Pure. */
export function formatCaughtError(reason: unknown): string {
  return reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
}

/** Logs the failure once, then pushes it to the renderer as toast-worthy
 * data (or buffers it, via `AppErrorGate`, if the renderer is not ready to
 * receive it yet); the renderer's reportError (errors/report.ts) is called
 * with `loggedByMain: true` so it never writes it to the log a second time. */
export function notifyMainFailure(scope: string, message: string): void {
  log.error(scope, message)
  for (const payload of appErrorGate.notify({ scope, message })) emit('app.error', payload)
}

/** Marks the renderer ready to receive `app.error` pushes and flushes
 * anything buffered before now. Call once the renderer's own
 * `subscribe('app.error', ...)` (main.tsx) is known to have already run —
 * index.ts does this on the window's first `did-finish-load`. */
export function markRendererReady(): void {
  for (const payload of appErrorGate.open()) emit('app.error', payload)
}
