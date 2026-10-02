import { app, BrowserWindow, nativeTheme } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { registerHandlers, emit } from './ipc/registry';
import { handlers } from './ipc/handlers';
import { createMainWindow } from './window';
import { log } from './log';
import { markRendererReady, notifyMainFailure } from './notify';
import { formatCaughtError } from './helpers/error';
import { startPortalThemeSync } from './helpers/portalTheme';

export function bootstrap(): void {
  // Electron derives the userData path from the app name at the first
  // `app.getPath()` call.
  app.setName('gepard');

  process.on('uncaughtException', (err) => {
    notifyMainFailure('app', `uncaughtException: ${formatCaughtError(err)}`);
  });
  process.on('unhandledRejection', (reason) => {
    notifyMainFailure('app', `unhandledRejection: ${formatCaughtError(reason)}`);
  });

  // Electron >= 36 on GNOME 48+/Fedora aborts at startup with a GTK 2/3 vs 4
  // symbol clash unless launched with --gtk-version=3.
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('gtk-version', '3');
  }

  app
    .whenReady()
    .then(() => {
      log.info(
        'app',
        `startup version=${app.getVersion()} electron=${process.versions.electron} ` +
          `chrome=${process.versions.chrome} node=${process.versions.node} ` +
          `platform=${process.platform} arch=${process.arch}`,
      );
      electronApp.setAppUserModelId('io.github.dee-gmiterko.gepard');

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window);
        window.webContents.once('did-finish-load', () => markRendererReady());
      });

      registerHandlers(handlers);

      const stopPortalThemeSync = startPortalThemeSync();
      app.on('will-quit', stopPortalThemeSync);

      nativeTheme.on('updated', () => {
        emit('theme.changed', { dark: nativeTheme.shouldUseDarkColors });
      });

      createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
      });
    })
    .catch((err: unknown) => {
      notifyMainFailure('app', `startup failed: ${formatCaughtError(err)}`);
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
