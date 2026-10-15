import { FolderPickerUnavailableError } from '@gepard/common';
import type { HandlerMap } from '../registry';
import type { ExtensionCatalogService } from '../../services/extensionCatalog';
import type { ExtensionInstallerService } from '../../services/extensionInstaller';
import type { ExtensionsService } from '../../services/extensions';

export class ExtensionsHandlers {
  constructor(
    private readonly extensions: ExtensionsService,
    private readonly catalog: ExtensionCatalogService,
    private readonly installer: ExtensionInstallerService,
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
      'extensions.dir': () => this.extensions.userDir(),

      'extensions.install': async (source, { window, remote }) => {
        if (source.kind === 'github-release') return this.installer.install(source);
        if (remote) throw new FolderPickerUnavailableError(this.extensions.userDir());
        const { dialog } = await import('electron');
        const options = { title: source.dialogTitle, properties: ['openDirectory' as const] };
        const { canceled, filePaths } = window
          ? await dialog.showOpenDialog(window, options)
          : await dialog.showOpenDialog(options);
        if (canceled || filePaths.length === 0) return this.extensions.list();
        return this.extensions.install(filePaths[0]);
      },

      'extensions.catalog': async () => ({ entries: await this.catalog.status() }),
    };
  }
}
