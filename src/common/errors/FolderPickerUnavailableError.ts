import { AppError } from './AppError';

export class FolderPickerUnavailableError extends AppError {
  constructor(public readonly directory: string) {
    super('FOLDER_PICKER_UNAVAILABLE', `the folder picker is not available: ${directory}`, {
      directory,
    });
    this.name = 'FolderPickerUnavailableError';
  }
}
