import { dialog } from 'electron';
import type { HandlerMap } from '../registry';
import { extensionRegistry } from '../../extensions/registry';
import { extensionsRootDir } from '../../paths';

export const extensionsHandlers: Pick<
  HandlerMap,
  'extensions.list' | 'extensions.setEnabled' | 'extensions.install' | 'extensions.dir'
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
};
