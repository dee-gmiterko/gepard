import { AppError } from './AppError';

export class AbortError extends AppError {
  constructor(message: string) {
    super('CANCELLED', message);
    this.name = 'AbortError';
  }
}
