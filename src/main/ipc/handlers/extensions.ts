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

  'extensions.install': async (_input, { window }) => {
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, {
          title: 'Add extension',
          properties: ['openFile'],
          filters: [{ name: 'Extension module', extensions: ['js', 'mjs', 'cjs'] }]
        })
      : await dialog.showOpenDialog({
          title: 'Add extension',
          properties: ['openFile'],
          filters: [{ name: 'Extension module', extensions: ['js', 'mjs', 'cjs'] }]
        })
    if (canceled || filePaths.length === 0) return extensionRegistry.list()
    return extensionRegistry.install(filePaths[0])
  }
}
