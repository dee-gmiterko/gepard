import { invoke, IpcError, isCancelledError } from '../ipc/client'
import { localizedErrorMessage } from './errorMessage'

export type ReportTone = 'danger' | 'warning'

export interface ReportedError {
  scope: string
  message: string
  tone?: ReportTone
  detail?: string
  loggedByMain?: boolean
}

type Listener = (error: ReportedError) => void
const listeners = new Set<Listener>()

export function onReportedError(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportError(error: ReportedError): void {
  for (const listener of listeners) listener(error)
  if (error.loggedByMain) return

  const message = error.detail ? `${error.message}\n${error.detail}` : error.message
  invoke('log.write', {
    level: error.tone === 'warning' ? 'warn' : 'error',
    scope: error.scope,
    message
  }).catch(() => {})
}

export function reportQueryError(scope: string, error: unknown): void {
  if (isCancelledError(error)) return
  const { message, detail } = localizedErrorMessage(error)
  reportError({ scope, message, detail: mergeDetail(detail, errorDetail(error)) })
}

function mergeDetail(primary: string | undefined, extra: string | undefined): string | undefined {
  return [primary, extra].filter(Boolean).join('\n') || undefined
}

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
