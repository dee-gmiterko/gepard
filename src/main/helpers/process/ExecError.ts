import { AppError } from '../../ipc/registry';

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
