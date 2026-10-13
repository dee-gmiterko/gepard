import { z } from 'zod';
import { AppError } from './AppError';

const missingDependencyDetails = z.object({ dependency: z.string().min(1) });

export class MissingDependencyError extends AppError {
  constructor(
    public readonly dependency: string,
    message = `${dependency}: not found`,
  ) {
    super('MISSING_DEPENDENCY', message, { dependency });
    this.name = 'MissingDependencyError';
  }

  static fromShape(shape: {
    message: string;
    details?: unknown;
  }): MissingDependencyError | undefined {
    const details = missingDependencyDetails.safeParse(shape.details);
    return details.success
      ? new MissingDependencyError(details.data.dependency, shape.message)
      : undefined;
  }
}
