import { spawn } from 'node:child_process';
import { z } from 'zod';
import { AppError } from '../../ipc/registry';

const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

export class ExecError extends AppError {
  constructor(
    code: string,
    message: string,
    public cmd: string,
    public args: string[],
    public exitCode: number | null,
    public stderr: string,
  ) {
    super(code, message, { cmd, args, exitCode, stderr });
  }
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  stdin?: string;
  onStderrLine?: (line: string) => void;
  maxBytes?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunBufferResult {
  stdout: Buffer;
  stderr: string;
  exitCode: number;
}

function stderrTail(stderr: string): string {
  return stderr.trim().split(/\r?\n/).slice(-5).join('\n');
}

// git progress output uses bare `\r`, not always `\n`.
function makeLineSplitter(onLine: (line: string) => void): (chunk: Buffer | string) => void {
  let buf = '';
  return (chunk) => {
    buf += chunk.toString('utf8');
    while (true) {
      const m = /\r\n|\r|\n/.exec(buf);
      if (!m) break;
      onLine(buf.slice(0, m.index));
      buf = buf.slice(m.index + m[0].length);
    }
  };
}

function spawnCollect(
  cmd: string,
  args: string[],
  opts: RunOptions = {},
): Promise<RunBufferResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      signal: opts.signal,
      killSignal: 'SIGTERM',
      timeout: opts.timeoutMs,
      windowsHide: true,
      stdio: [opts.stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    let stderr = '';
    let bytes = 0;
    let tooLarge = false;

    child.stdout?.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        tooLarge = true;
        child.kill('SIGTERM');
        return;
      }
      stdoutChunks.push(chunk);
    });

    const splitStderr = makeLineSplitter((line) => opts.onStderrLine?.(line));
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      splitStderr(chunk);
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.name === 'AbortError') return reject(err);
      if (err.code === 'ENOENT') {
        return reject(
          new ExecError('EXEC_NOT_FOUND', `${cmd}: not found`, cmd, args, null, stderr),
        );
      }
      reject(new ExecError('EXEC_FAILED', err.message, cmd, args, null, stderr));
    });

    child.on('close', (exitCode, signal) => {
      if (tooLarge) {
        return reject(
          new ExecError(
            'EXEC_TOO_LARGE',
            `${cmd} output exceeded ${maxBytes} bytes`,
            cmd,
            args,
            exitCode,
            stderr,
          ),
        );
      }
      if (exitCode === 0)
        return resolve({ stdout: Buffer.concat(stdoutChunks), stderr, exitCode: 0 });
      // Node reports a null exit code and a signal when the process is killed,
      // including by its own `timeout` option.
      if (signal) {
        return reject(
          new ExecError(
            'EXEC_FAILED',
            `${cmd} was killed by signal ${signal}`,
            cmd,
            args,
            null,
            stderr,
          ),
        );
      }
      const detail = stderrTail(stderr);
      reject(
        new ExecError(
          'EXEC_FAILED',
          detail
            ? `${cmd} exited with code ${exitCode}: ${detail}`
            : `${cmd} exited with code ${exitCode}`,
          cmd,
          args,
          exitCode,
          stderr,
        ),
      );
    });

    if (opts.stdin !== undefined) {
      // Writing to the stdin of a child that has already exited emits EPIPE.
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(opts.stdin);
    }
  });
}

export async function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const { stdout, stderr, exitCode } = await spawnCollect(cmd, args, opts);
  return { stdout: stdout.toString('utf8'), stderr, exitCode };
}

export function runBuffer(
  cmd: string,
  args: string[],
  opts: RunOptions = {},
): Promise<RunBufferResult> {
  return spawnCollect(cmd, args, opts);
}

export async function runJson<T extends z.ZodType>(
  schema: T,
  cmd: string,
  args: string[],
  opts: RunOptions = {},
): Promise<z.output<T>> {
  const { stdout } = await run(cmd, args, opts);
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch (e) {
    throw new AppError('BAD_JSON', `${cmd} did not return valid JSON: ${(e as Error).message}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AppError('SCHEMA_MISMATCH', z.prettifyError(parsed.error), parsed.error.issues);
  }
  return parsed.data;
}
