import { AppError } from '@gepard/common';
import type { FolderPicker } from '@gepard/main/ports/native';
import type { Paths } from '@gepard/main/main/paths';

export class ServerFolderPicker implements FolderPicker {
  constructor(private readonly paths: Paths) {}

  pickFolder(): Promise<string | null> {
    return Promise.reject(
      new AppError(
        'UNAVAILABLE',
        `Folders can only be picked in the desktop app. Copy the extension into ${this.paths.extensionsRootDir()} instead.`,
      ),
    );
  }
}
