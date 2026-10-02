import { ExecError } from './ExecError';

function stderrTail(stderr: string): string {
  return stderr.trim().split(/\r?\n/).slice(-5).join('\n');
}

function exitMessage(
  cmd: string,
  exitCode: number | null,
  signal: string | null,
  stderr: string,
): string {
  if (signal) return `${cmd} was killed by signal ${signal}`;
  const detail = stderrTail(stderr);
  return detail
    ? `${cmd} exited with code ${exitCode}: ${detail}`
    : `${cmd} exited with code ${exitCode}`;
}

export class ExecExitError extends ExecError {
  constructor(
    cmd: string,
    args: string[],
    exitCode: number | null,
    signal: string | null,
    stderr: string,
  ) {
    super(
      'EXEC_FAILED',
      exitMessage(cmd, exitCode, signal, stderr),
      cmd,
      args,
      signal ? null : exitCode,
      stderr,
    );
  }
}
