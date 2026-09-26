// Renderer-originated logging (coordinator spec: every failure in the app is
// always logged and shown to the user through one unified toast surface).
// React render errors, window/unhandledrejection failures, and failed
// queries/mutations all funnel through the renderer's
// `src/renderer/src/errors/report.ts`, which calls this channel so they land
// in the same `<userData>/logs/main.log` main already writes for its own
// failures (src/main/log.ts) — not just a toast that disappears.
import type { HandlerMap } from '../registry'
import { log } from '../../log'

export const logHandlers: Pick<HandlerMap, 'log.write'> = {
  'log.write': ({ level, scope, message }) => {
    log[level](`renderer:${scope}`, message)
  }
}
