// Minimal main-process logger (report 04 goal: failures in the packaged app
// must be readable afterwards). Appends `ISO-time level scope message` lines
// to `<userData>/logs/main.log`. No rotation library: once per process
// startup the file is capped by truncating to its last half if it has grown
// past 5 MB. Writes are synchronous so a message logged right before a crash
// is not lost to a pending async flush.
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { logsDir } from './paths'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const LOG_FILE_NAME = 'main.log'

export type LogLevel = 'info' | 'warn' | 'error'

let initialized = false

function logFilePath(): string {
  return join(logsDir(), LOG_FILE_NAME)
}

/** Truncates the log file to its last half (on a line boundary) once it
 * passes MAX_BYTES. Checked once, at first use. */
function capIfTooLarge(): void {
  const path = logFilePath()
  let size: number
  try {
    size = statSync(path).size
  } catch {
    return // no log file yet
  }
  if (size <= MAX_BYTES) return
  try {
    const content = readFileSync(path, 'utf8')
    const half = content.slice(Math.floor(content.length / 2))
    const firstNewline = half.indexOf('\n')
    const trimmed = firstNewline >= 0 ? half.slice(firstNewline + 1) : half
    writeFileSync(path, trimmed)
  } catch {
    // best effort; logging must never crash the app
  }
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  try {
    mkdirSync(logsDir(), { recursive: true })
    capIfTooLarge()
  } catch {
    // best effort; logging must never crash the app
  }
}

function write(level: LogLevel, scope: string, message: string): void {
  ensureInitialized()
  const line = `${new Date().toISOString()} ${level} ${scope} ${message}\n`
  try {
    appendFileSync(logFilePath(), line)
  } catch {
    // best effort; logging must never crash the app
  }
  // app.isPackaged is false in dev; mirror to stderr there (report 04 §1.4-style dev ergonomics).
  if (!app.isPackaged) {
    process.stderr.write(line)
  }
}

export const log = {
  info(scope: string, message: string): void {
    write('info', scope, message)
  },
  warn(scope: string, message: string): void {
    write('warn', scope, message)
  },
  error(scope: string, message: string): void {
    write('error', scope, message)
  }
}
