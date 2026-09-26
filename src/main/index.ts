import { app, BrowserWindow, nativeTheme } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerHandlers, emit } from './ipc/registry'
import { handlers } from './ipc/handlers'
import { createMainWindow } from './window'
import { log } from './log'
import { formatCaughtError, markRendererReady, notifyMainFailure } from './notify'

// app.setName must run before any app.getPath() call (paths.ts) so dev and
// prod agree on the userData path (report 04 §4.1).
app.setName('gh-large-review')

// Errors that would otherwise crash the process silently: the whole point of
// log.ts is that a failure in the packaged app can be read afterwards. Not
// the result of a renderer request, so besides logging they must also reach
// the toast surface themselves (coordinator spec) via notifyMainFailure.
process.on('uncaughtException', (err) => {
  notifyMainFailure('app', `uncaughtException: ${formatCaughtError(err)}`)
})
process.on('unhandledRejection', (reason) => {
  notifyMainFailure('app', `unhandledRejection: ${formatCaughtError(reason)}`)
})

// Electron >= 36 on GNOME 48+/Fedora aborts at startup with a GTK 2/3 vs 4
// symbol clash unless launched with --gtk-version=3 (report 04 §1.4).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('gtk-version', '3')
}

app.whenReady().then(() => {
  log.info(
    'app',
    `startup version=${app.getVersion()} electron=${process.versions.electron} ` +
      `chrome=${process.versions.chrome} node=${process.versions.node} ` +
      `platform=${process.platform} arch=${process.arch}`
  )
  electronApp.setAppUserModelId('com.ghlargereview.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    // By the time a window's first load finishes, its renderer's module-level
    // `subscribe('app.error', ...)` (main.tsx) has already run — module
    // scripts execute before the page's load event, which is what triggers
    // `did-finish-load` — so any `app.error` buffered before now (gap: a
    // failure before any window existed, or before this point) can be
    // flushed safely (notify.ts#AppErrorGate).
    window.webContents.once('did-finish-load', () => markRendererReady())
  })

  registerHandlers(handlers)

  // nativeTheme -> theme.changed (report 04 §6): the renderer switches both
  // the styled-components theme and the CodeMirror theme extension on this.
  nativeTheme.on('updated', () => {
    emit('theme.changed', { dark: nativeTheme.shouldUseDarkColors })
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
