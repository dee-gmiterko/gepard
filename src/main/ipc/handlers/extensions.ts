import { app, dialog } from 'electron';
import type { HandlerMap } from '../registry';
import { extensionRegistry } from '../../extensions/registry';
import { catalogStatus, loadCatalog } from '../../extensions/catalog';
import { ExtensionInstaller } from '../../extensions/releases';
import { extensionsRootDir } from '../../paths';
import { log } from '../../log';

const installer = new ExtensionInstaller({
  registry: extensionRegistry,
  tmpDir: () => app.getPath('temp'),
});

export const extensionsHandlers: Pick<
  HandlerMap,
  | 'extensions.list'
  | 'extensions.setEnabled'
  | 'extensions.install'
  | 'extensions.dir'
  | 'extensions.catalog'
  | 'extensions.installFromCatalog'
  | 'extensions.installFromRepo'
> = {
  'extensions.list': () => extensionRegistry.list(),
  'extensions.setEnabled': ({ id, enabled }) => extensionRegistry.setEnabled(id, enabled),
  'extensions.dir': () => extensionsRootDir(),

  'extensions.install': async ({ dialogTitle }, { window }) => {
    const options = { title: dialogTitle, properties: ['openDirectory' as const] };
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (canceled || filePaths.length === 0) return extensionRegistry.list();
    return extensionRegistry.install(filePaths[0]);
  },

  'extensions.catalog': async () => {
    const [loaded, installed] = await Promise.all([loadCatalog(), extensionRegistry.list()]);
    if (loaded.error)
      log.warn('extensions', `using the bundled extension catalog: ${loaded.error}`);
    return {
      source: loaded.source,
      entries: catalogStatus(loaded.catalog, installed, `${process.platform}-${process.arch}`),
    };
  },
  'extensions.installFromCatalog': ({ name }) => installer.installFromCatalog(name),
  'extensions.installFromRepo': ({ repository, path }) =>
    installer.installFromRepo(repository, path),
};
