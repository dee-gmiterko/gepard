import { AppError } from './AppError';

export class StaleShaError extends AppError {
  constructor(message: string) {
    super('STALE_SHA', message);
    this.name = 'StaleShaError';
  }
}
