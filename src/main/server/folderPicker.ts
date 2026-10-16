import { FolderPickerUnavailableError } from '@gepard/common';
import type { FolderPicker } from '../native';
import type { Paths } from '../paths';

export class ServerFolderPicker implements FolderPicker {
  constructor(private readonly paths: Paths) {}

  pickFolder(): Promise<string | null> {
    return Promise.reject(new FolderPickerUnavailableError(this.paths.extensionsRootDir()));
  }
}
