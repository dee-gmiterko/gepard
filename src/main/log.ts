import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { logsDir } from './paths'

const MAX_BYTES = 5 * 1024 * 1024
const LOG_FILE_NAME = 'main.log'

export type LogLevel = 'info' | 'warn' | 'error'

function logFilePath(): string {
  return join(logsDir(), LOG_FILE_NAME)
}

let dirReady: Promise<void> | null = null

function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = mkdir(logsDir(), { recursive: true }).then(
      () => undefined,
      () => undefined
    )
  }
  return dirReady
}

async function capIfTooLarge(): Promise<void> {
  const path = logFilePath()
  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    return
  }
  if (size <= MAX_BYTES) return
  try {
    const content = await readFile(path, 'utf8')
    const half = content.slice(Math.floor(content.length / 2))
    const firstNewline = half.indexOf('\n')
    const trimmed = firstNewline >= 0 ? half.slice(firstNewline + 1) : half
    await writeFile(path, trimmed)
  } catch {
    void 0
  }
}

let queue: Promise<void> = Promise.resolve()

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task, task)
}

async function write(level: LogLevel, scope: string, message: string): Promise<void> {
  await ensureDir()
  await capIfTooLarge()
  const line = `${new Date().toISOString()} ${level} ${scope} ${message}\n`
  try {
    await appendFile(logFilePath(), line)
  } catch {
    void 0
  }
  if (!app.isPackaged) {
    process.stderr.write(line)
  }
}

export const log = {
  info(scope: string, message: string): void {
    enqueue(() => write('info', scope, message))
  },
  warn(scope: string, message: string): void {
    enqueue(() => write('warn', scope, message))
  },
  error(scope: string, message: string): void {
    enqueue(() => write('error', scope, message))
  }
}
