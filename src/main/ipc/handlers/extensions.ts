import type { HandlerMap } from '../dispatch';
import type { FolderPicker } from '../../native';
import type { ExtensionCatalogService } from '../../services/extensionCatalog';
import type { ExtensionInstallerService } from '../../services/extensionInstaller';
import type { ExtensionsService } from '../../services/extensions';

export class ExtensionsHandlers {
  constructor(
    private readonly extensions: ExtensionsService,
    private readonly catalog: ExtensionCatalogService,
    private readonly installer: ExtensionInstallerService,
    private readonly folderPicker: FolderPicker,
  ) {}

  toHandlerMap(): Pick<
    HandlerMap,
    | 'extensions.list'
    | 'extensions.setEnabled'
    | 'extensions.install'
    | 'extensions.dir'
    | 'extensions.catalog'
  > {
    return {
      'extensions.list': () => this.extensions.list(),
      'extensions.setEnabled': ({ id, enabled }) => this.extensions.setEnabled(id, enabled),
      'extensions.dir': () => this.extensions.userDir,

      'extensions.install': async (source, { window }) => {
        if (source.kind === 'github-release') return this.installer.install(source);
        const folder = await this.folderPicker.pickFolder(window, source.dialogTitle);
        return folder === null ? this.extensions.list() : this.extensions.install(folder);
      },

      'extensions.catalog': async () => ({ entries: await this.catalog.status() }),
    };
  }
}
