import { app, BrowserWindow, nativeTheme } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { parseProcessCli } from './cli';
import { composeElectron } from './di';
import { registerHandlers } from '../ipc/ipc';
import { formatCaughtError } from '@gepard/main/helpers/error';

const QUIT_CLOSE_TIMEOUT_MS = 1_000;

export function bootstrap(): void {
  // Electron derives the userData path from the app name at the first
  // `app.getPath()` call.
  app.setName('gepard');

  const { core, portalTheme, systemPreference, contextMenu, dispatch, windows } =
    composeElectron(parseProcessCli());
  const { logger, notify, events, launch, indexer } = core;

  process.on('uncaughtException', (err) => {
    notify.mainFailure('app', `uncaughtException: ${formatCaughtError(err)}`);
  });
  process.on('unhandledRejection', (reason) => {
    notify.mainFailure('app', `unhandledRejection: ${formatCaughtError(reason)}`);
  });

  // Electron >= 36 on GNOME 48+/Fedora aborts at startup with a GTK 2/3 vs 4
  // symbol clash unless launched with --gtk-version=3.
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('gtk-version', '3');
  }

  app
    .whenReady()
    .then(() => {
      logger.info(
        'app',
        `startup version=${app.getVersion()} electron=${process.versions.electron} ` +
          `chrome=${process.versions.chrome} node=${process.versions.node} ` +
          `platform=${process.platform} arch=${process.arch}`,
      );
      electronApp.setAppUserModelId('io.github.dee-gmiterko.gepard');

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window);
        window.webContents.once('did-finish-load', () => notify.rendererReady());
        contextMenu.install(window.webContents);
      });

      registerHandlers(dispatch, events);
      const emitSystemPreferenceChanged = (): void =>
        events.emit('systemPreference.changed', systemPreference.get());
      const stopPortalThemeSync = portalTheme.startSync(emitSystemPreferenceChanged);
      app.on('will-quit', stopPortalThemeSync);

      nativeTheme.on('updated', emitSystemPreferenceChanged);

      void launch.startup();
      windows.create();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) windows.create();
      });
    })
    .catch((err: unknown) => {
      notify.mainFailure('app', `startup failed: ${formatCaughtError(err)}`);
    });

  let closingSessions = false;
  app.on('before-quit', (event) => {
    if (closingSessions) return;
    closingSessions = true;
    event.preventDefault();
    const cap = new Promise<void>((resolve) => setTimeout(resolve, QUIT_CLOSE_TIMEOUT_MS));
    void Promise.race([indexer.closeAll(), cap]).finally(() => app.quit());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
