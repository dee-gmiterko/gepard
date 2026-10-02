import { ExecError } from './ExecError';

export class ExecSpawnError extends ExecError {
  constructor(err: NodeJS.ErrnoException, cmd: string, args: string[], stderr: string) {
    super(
      err.code === 'ENOENT' ? 'EXEC_NOT_FOUND' : 'EXEC_FAILED',
      err.code === 'ENOENT' ? `${cmd}: not found` : err.message,
      cmd,
      args,
      null,
      stderr,
    );
  }
}
