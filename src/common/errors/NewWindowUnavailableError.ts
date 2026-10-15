import { AppError } from './AppError';

export class NewWindowUnavailableError extends AppError {
  constructor() {
    super('NEW_WINDOW_UNAVAILABLE', 'opening a new window is not available');
    this.name = 'NewWindowUnavailableError';
  }
}
