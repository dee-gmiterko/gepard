import { AppError } from './AppError';

export class RateLimitError extends AppError {
  constructor(message: string, details?: unknown) {
    super('RATE_LIMITED', message, details);
    this.name = 'RateLimitError';
  }
}
