import { dialog } from 'electron';
import type { HandlerMap } from '../registry';
import { extensionCatalogService, extensionInstallerService, extensionsService } from '../../di';

export const extensionsHandlers: Pick<
  HandlerMap,
  | 'extensions.list'
  | 'extensions.setEnabled'
  | 'extensions.install'
  | 'extensions.dir'
  | 'extensions.catalog'
> = {
  'extensions.list': () => extensionsService.list(),
  'extensions.setEnabled': ({ id, enabled }) => extensionsService.setEnabled(id, enabled),
  'extensions.dir': () => extensionsService.userDir(),

  'extensions.install': async (source, { window }) => {
    if (source.kind === 'github-release') return extensionInstallerService.install(source);
    const options = { title: source.dialogTitle, properties: ['openDirectory' as const] };
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (canceled || filePaths.length === 0) return extensionsService.list();
    return extensionsService.install(filePaths[0]);
  },

  'extensions.catalog': async () => ({ entries: await extensionCatalogService.status() }),
};
