import { AppError } from './AppError';

export class MissingDependencyError extends AppError {
  constructor(
    public readonly dependency: string,
    message = `${dependency}: not found`,
  ) {
    super('MISSING_DEPENDENCY', message, { dependency });
    this.name = 'MissingDependencyError';
  }
}
