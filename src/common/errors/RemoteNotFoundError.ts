import { AppError } from './AppError';

export class RemoteNotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, details);
    this.name = 'RemoteNotFoundError';
  }
}
