import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { logsDir } from './paths'

const MAX_BYTES = 5 * 1024 * 1024
const LOG_FILE_NAME = 'main.log'

export type LogLevel = 'info' | 'warn' | 'error'

let initialized = false

function logFilePath(): string {
  return join(logsDir(), LOG_FILE_NAME)
}

function capIfTooLarge(): void {
  const path = logFilePath()
  let size: number
  try {
    size = statSync(path).size
  } catch {
    return
  }
  if (size <= MAX_BYTES) return
  try {
    const content = readFileSync(path, 'utf8')
    const half = content.slice(Math.floor(content.length / 2))
    const firstNewline = half.indexOf('\n')
    const trimmed = firstNewline >= 0 ? half.slice(firstNewline + 1) : half
    writeFileSync(path, trimmed)
  } catch {
    // Logging must never throw into the caller.
  }
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  try {
    mkdirSync(logsDir(), { recursive: true })
    capIfTooLarge()
  } catch {
    // Logging must never throw into the caller.
  }
}

// Writes are synchronous so a message logged right before a crash isn't
// lost to a pending async flush.
function write(level: LogLevel, scope: string, message: string): void {
  ensureInitialized()
  const line = `${new Date().toISOString()} ${level} ${scope} ${message}\n`
  try {
    appendFileSync(logFilePath(), line)
  } catch {
    // Logging must never throw into the caller.
  }
  // Electron's app.isPackaged is false in dev and true in a packaged build.
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
