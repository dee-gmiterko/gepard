// Single spawn point for `gh`/`git`/`rg` (report 04 §3.1). `spawn` (not
// `execFile`) so stderr can be streamed line-by-line for progress.
import { spawn } from 'node:child_process'
import { z } from 'zod'
import { AppError } from '../ipc/registry'

const DEFAULT_MAX_BYTES = 256 * 1024 * 1024 // 256 MB; large diffs

export class ExecError extends AppError {
  constructor(
    code: string,
    message: string,
    public cmd: string,
    public args: string[],
    public exitCode: number | null,
    public stderr: string
  ) {
    super(code, message, { cmd, args, exitCode, stderr })
  }
}

export interface RunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  timeoutMs?: number
  stdin?: string
  onStderrLine?: (line: string) => void
  maxBytes?: number
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface RunBufferResult {
  stdout: Buffer
  stderr: string
  exitCode: number
}

/** Last few lines of stderr, so the error message stays short. */
function stderrTail(stderr: string): string {
  return stderr.trim().split(/\r?\n/).slice(-5).join('\n')
}

/** Splits a stream of chunks on `\r\n|\r|\n` (git progress uses bare `\r`). */
function makeLineSplitter(onLine: (line: string) => void): (chunk: Buffer | string) => void {
  let buf = ''
  return (chunk) => {
    buf += chunk.toString('utf8')
    while (true) {
      const m = /\r\n|\r|\n/.exec(buf)
      if (!m) break
      onLine(buf.slice(0, m.index))
      buf = buf.slice(m.index + m[0].length)
    }
  }
}

/** Shared spawn/collect core for `run`/`runBuffer`: stdout is kept as raw
 * `Buffer` chunks (never decoded) so binary-sensitive callers (git blob
 * content: images, binary files) get exact bytes; `run` decodes to UTF-8 on
 * top of this. */
function spawnCollect(
  cmd: string,
  args: string[],
  opts: RunOptions = {}
): Promise<RunBufferResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      signal: opts.signal,
      killSignal: 'SIGTERM',
      timeout: opts.timeoutMs,
      windowsHide: true,
      stdio: [opts.stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe']
    })

    const stdoutChunks: Buffer[] = []
    let stderr = ''
    let bytes = 0
    let tooLarge = false

    child.stdout?.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > maxBytes) {
        tooLarge = true
        child.kill('SIGTERM')
        return
      }
      stdoutChunks.push(chunk)
    })

    const splitStderr = makeLineSplitter((line) => opts.onStderrLine?.(line))
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      splitStderr(chunk)
    })

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.name === 'AbortError') return reject(err)
      if (err.code === 'ENOENT') {
        return reject(new ExecError('EXEC_NOT_FOUND', `${cmd}: not found`, cmd, args, null, stderr))
      }
      reject(new ExecError('EXEC_FAILED', err.message, cmd, args, null, stderr))
    })

    child.on('close', (exitCode, signal) => {
      if (tooLarge) {
        return reject(
          new ExecError(
            'EXEC_TOO_LARGE',
            `${cmd} output exceeded ${maxBytes} bytes`,
            cmd,
            args,
            exitCode,
            stderr
          )
        )
      }
      if (exitCode === 0)
        return resolve({ stdout: Buffer.concat(stdoutChunks), stderr, exitCode: 0 })
      // exitCode is null when the process was killed by a signal — including
      // spawn's own `timeout`/`killSignal` firing — which is a failure, not a
      // clean exit; do not treat it as success.
      if (signal) {
        return reject(
          new ExecError(
            'EXEC_FAILED',
            `${cmd} was killed by signal ${signal}`,
            cmd,
            args,
            null,
            stderr
          )
        )
      }
      // Report 04 §3.2: "On failure show gh's stderr" (same for git/rg).
      const detail = stderrTail(stderr)
      reject(
        new ExecError(
          'EXEC_FAILED',
          detail
            ? `${cmd} exited with code ${exitCode}: ${detail}`
            : `${cmd} exited with code ${exitCode}`,
          cmd,
          args,
          exitCode,
          stderr
        )
      )
    })

    if (opts.stdin !== undefined) {
      child.stdin?.end(opts.stdin)
    }
  })
}

export async function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const { stdout, stderr, exitCode } = await spawnCollect(cmd, args, opts)
  return { stdout: stdout.toString('utf8'), stderr, exitCode }
}

/** Like `run`, but returns raw stdout bytes instead of decoding them as
 * UTF-8, which would corrupt arbitrary binary content (e.g. `git cat-file
 * blob` for images/binary files). Same hardening/options as `run`. */
export function runBuffer(
  cmd: string,
  args: string[],
  opts: RunOptions = {}
): Promise<RunBufferResult> {
  return spawnCollect(cmd, args, opts)
}

/** All external JSON enters through this function. */
export async function runJson<T extends z.ZodType>(
  schema: T,
  cmd: string,
  args: string[],
  opts: RunOptions = {}
): Promise<z.output<T>> {
  const { stdout } = await run(cmd, args, opts)
  let json: unknown
  try {
    json = JSON.parse(stdout)
  } catch (e) {
    throw new AppError('BAD_JSON', `${cmd} did not return valid JSON: ${(e as Error).message}`)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new AppError('SCHEMA_MISMATCH', z.prettifyError(parsed.error), parsed.error.issues)
  }
  return parsed.data
}
