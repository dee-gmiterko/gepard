import { dialog } from 'electron'
import type { HandlerMap } from '../registry'
import { extensionRegistry } from '../../lsp'
import { extensionsDir } from '../../paths'

export const extensionsHandlers: Pick<
  HandlerMap,
  'extensions.list' | 'extensions.setEnabled' | 'extensions.install' | 'extensions.dir'
> = {
  'extensions.list': () => extensionRegistry.list(),
  'extensions.setEnabled': ({ id, enabled }) => extensionRegistry.setEnabled(id, enabled),
  'extensions.dir': () => extensionsDir(),

  'extensions.install': async ({ dialogTitle, filterName }, { window }) => {
    const filters = [{ name: filterName, extensions: ['js', 'mjs', 'cjs'] }]
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, {
          title: dialogTitle,
          properties: ['openFile'],
          filters
        })
      : await dialog.showOpenDialog({ title: dialogTitle, properties: ['openFile'], filters })
    if (canceled || filePaths.length === 0) return extensionRegistry.list()
    return extensionRegistry.install(filePaths[0])
  }
}
