import { AppError } from './AppError';

export class ConnectionError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONNECTION_FAILED', message, details);
    this.name = 'ConnectionError';
  }
}
