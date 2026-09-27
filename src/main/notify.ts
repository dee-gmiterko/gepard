// `webContents.send` reaches only windows that already exist and have
// registered a listener; it does not queue messages.
import { emit } from './ipc/registry'
import { log } from './log'

export interface AppErrorPayload {
  scope: string
  message: string
}

export class AppErrorGate {
  private ready = false
  private pending: AppErrorPayload[] = []

  notify(payload: AppErrorPayload): AppErrorPayload[] {
    if (this.ready) return [payload]
    this.pending.push(payload)
    return []
  }

  open(): AppErrorPayload[] {
    if (this.ready) return []
    this.ready = true
    return this.pending.splice(0)
  }
}

const appErrorGate = new AppErrorGate()

export function isNotifiableLevel(level: 'info' | 'warn' | 'error'): boolean {
  return level === 'error'
}

export function formatCaughtError(reason: unknown): string {
  return reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
}

export function notifyMainFailure(scope: string, message: string): void {
  log.error(scope, message)
  for (const payload of appErrorGate.notify({ scope, message })) emit('app.error', payload)
}

export function markRendererReady(): void {
  for (const payload of appErrorGate.open()) emit('app.error', payload)
}
