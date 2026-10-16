import { FolderPickerUnavailableError } from '@gepard/common';
import type { FolderPicker } from '@gepard/main/native';
import type { Paths } from '@gepard/main/paths';

export class ServerFolderPicker implements FolderPicker {
  constructor(private readonly paths: Paths) {}

  pickFolder(): Promise<string | null> {
    return Promise.reject(new FolderPickerUnavailableError(this.paths.extensionsRootDir()));
  }
}
