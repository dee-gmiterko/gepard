import { app, dialog } from 'electron';
import type { HandlerMap } from '../registry';
import { extensionRegistry } from '../../extensions/registry';
import { catalogStatus, extensionCatalog } from '../../extensions/catalog';
import { ExtensionInstaller } from '../../extensions/githubRelease';
import { extensionsRootDir } from '../../paths';

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
> = {
  'extensions.list': () => extensionRegistry.list(),
  'extensions.setEnabled': ({ id, enabled }) => extensionRegistry.setEnabled(id, enabled),
  'extensions.dir': () => extensionsRootDir(),

  'extensions.install': async (source, { window }) => {
    if (source.kind === 'github-release') return installer.install(source);
    const options = { title: source.dialogTitle, properties: ['openDirectory' as const] };
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (canceled || filePaths.length === 0) return extensionRegistry.list();
    return extensionRegistry.install(filePaths[0]);
  },

  'extensions.catalog': async () => ({
    entries: catalogStatus(
      extensionCatalog,
      await extensionRegistry.list(),
      `${process.platform}-${process.arch}`,
    ),
  }),
};
