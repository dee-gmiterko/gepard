import { join } from 'node:path';
import { app } from 'electron';
import { composeCore, composeHandlers, type Core } from '@gepard/main/di';
import { Paths, resolveUserDataDir } from '@gepard/main/paths';
import { IpcDispatchService } from '@gepard/main/ipc/dispatch';
import { SystemPreferenceService } from '@gepard/main/services/systemPreference';
import type { Cli } from './cli';
import { ContextMenuService } from './contextMenu';
import { ElectronInstanceLauncher } from './instanceLauncher';
import { ElectronNativeUi } from './nativeUi';
import { ElectronSystemPreferenceSource } from './systemPreference';
import { PortalTheme } from './portalTheme';
import { MainWindowService, focusMainWindow } from './window';

export interface ElectronComposition {
  core: Core;
  portalTheme: PortalTheme;
  systemPreference: SystemPreferenceService;
  contextMenu: ContextMenuService;
  dispatch: IpcDispatchService;
  windows: MainWindowService;
}

function builtinExtensionsDir(appPath: string): string {
  return app.isPackaged
    ? join(appPath, '..', 'extensions')
    : join(appPath, '..', '..', 'dist', 'extensions');
}

export function composeElectron(cli: Cli): ElectronComposition {
  const appPath = app.getAppPath();
  const paths = new Paths(
    resolveUserDataDir(process.platform, process.env),
    builtinExtensionsDir(appPath),
  );
  const core = composeCore(paths, {
    target: cli.target,
    logToConsole: !app.isPackaged,
    instances: (logger) => new ElectronInstanceLauncher(logger, appPath),
    focusWindow: focusMainWindow,
  });
  const portalTheme = new PortalTheme(core.logger);
  const systemPreference = new SystemPreferenceService(
    new ElectronSystemPreferenceSource(portalTheme),
  );
  const nativeUi = new ElectronNativeUi();
  const contextMenu = new ContextMenuService(nativeUi, core.notify);
  const dispatch = new IpcDispatchService(
    composeHandlers(core, nativeUi, contextMenu, systemPreference),
  );
  const windows = new MainWindowService(core.notify, cli.reportWindowShown);
  return { core, portalTheme, systemPreference, contextMenu, dispatch, windows };
}
