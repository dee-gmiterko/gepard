import { app } from 'electron';
import type { Cli } from './cli';
import { composeCore, composeHandlers, type Core } from './di';
import { Paths, resolveUserDataDir } from './paths';
import { IpcDispatchService } from './ipc/dispatch';
import { ContextMenuService } from './electronContextMenu';
import { ElectronNativeUi } from './electronNativeUi';
import { ElectronSystemPreferenceSource } from './electronSystemPreference';
import { PortalTheme } from './electronPortalTheme';
import { MainWindowService, focusMainWindow } from './electronWindow';
import { SystemPreferenceService } from './services/systemPreference';

export interface ElectronComposition {
  core: Core;
  portalTheme: PortalTheme;
  systemPreference: SystemPreferenceService;
  contextMenu: ContextMenuService;
  dispatch: IpcDispatchService;
  windows: MainWindowService;
}

export function composeElectron(cli: Cli): ElectronComposition {
  const paths = new Paths(
    resolveUserDataDir(process.platform, process.env),
    app.getAppPath(),
    app.isPackaged,
  );
  const core = composeCore(paths, cli, focusMainWindow);
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
