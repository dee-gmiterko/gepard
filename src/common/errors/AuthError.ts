import { AppError } from './AppError';

export class AuthError extends AppError {
  constructor(message: string, details?: unknown) {
    super('AUTH_REQUIRED', message, details);
    this.name = 'AuthError';
  }
}
