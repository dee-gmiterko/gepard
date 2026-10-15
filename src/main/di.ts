import { app } from 'electron';
import { ExtensionCatalog } from '@gepard/common';
import catalogJson from '../../extensions/catalog.json';
import { GhClient } from './clients/gh';
import { GitClient } from './clients/git';
import { cli } from './cli';
import { KIND_SPECS } from './extensions/kindSpecs';
import { platformTarget } from './helpers/platform';
import { run, runBuffer, runJson } from './helpers/process/exec';
import { CommentsHandlers } from './ipc/handlers/comments';
import { ConnectivityHandlers } from './ipc/handlers/connectivity';
import { ContextMenuHandlers } from './ipc/handlers/contextMenu';
import { ExtensionsHandlers } from './ipc/handlers/extensions';
import { FilesHandlers } from './ipc/handlers/files';
import { GrammarsHandlers } from './ipc/handlers/grammars';
import { KeybindingsHandlers } from './ipc/handlers/keybindings';
import { LaunchHandlers } from './ipc/handlers/launch';
import { LocalesHandlers } from './ipc/handlers/locales';
import { LogHandlers } from './ipc/handlers/log';
import { ProjectsHandlers } from './ipc/handlers/projects';
import { PrsHandlers } from './ipc/handlers/prs';
import { SearchHandlers } from './ipc/handlers/search';
import { SyncHandlers } from './ipc/handlers/sync';
import { SystemPreferenceHandlers } from './ipc/handlers/systemPreference';
import { ThemeHandlers } from './ipc/handlers/theme';
import { emit } from './ipc/registry';
import type { HandlerMap } from './ipc/registry';
import { IndexerService } from './lsp/indexer';
import { builtinExtensionsDir, extensionsRootDir } from './paths';
import { ConnectivityService } from './services/connectivity';
import { ExtensionCatalogService } from './services/extensionCatalog';
import { ExtensionInstallerService } from './services/extensionInstaller';
import { ExtensionScannerService } from './services/extensionScanner';
import { ExtensionsService } from './services/extensions';
import { GhService } from './services/gh';
import { GitService } from './services/git';
import { LaunchService } from './services/launch';
import { ReleaseDownloadService } from './services/releaseDownload';
import { SyncService } from './services/sync';
import { getProject } from './store/projects';

export const connectivity = new ConnectivityService((offline) =>
  emit('connectivity.changed', { offline }),
);

export const ghClient = new GhClient(connectivity, run, runJson);
export const gitClient = new GitClient(connectivity, run, runBuffer);

export const extensionScannerService = new ExtensionScannerService(
  extensionsRootDir,
  builtinExtensionsDir,
  KIND_SPECS,
);

export const extensionsService = new ExtensionsService(extensionsRootDir, extensionScannerService);

export const extensionCatalogService = new ExtensionCatalogService(
  ExtensionCatalog.parse(catalogJson),
  extensionsService,
  platformTarget(),
);

export const releaseDownloadService = new ReleaseDownloadService(ghClient, () =>
  app.getPath('temp'),
);

export const extensionInstallerService = new ExtensionInstallerService(
  extensionsService,
  extensionCatalogService,
  ghClient,
  releaseDownloadService,
  platformTarget(),
);

export const indexer = new IndexerService(extensionsService);

export const ghService = new GhService(getProject, ghClient);
export const gitService = new GitService(indexer, gitClient);
export const syncService = new SyncService(ghService, gitService);
export const launchService = new LaunchService(gitService, indexer, cli.target);

export const handlers: HandlerMap = {
  ...new ProjectsHandlers(ghService, gitService, indexer).toHandlerMap(),
  ...new LaunchHandlers(launchService).toHandlerMap(),
  ...new PrsHandlers(ghService, gitService).toHandlerMap(),
  ...new FilesHandlers(gitService).toHandlerMap(),
  ...new SearchHandlers(indexer).toHandlerMap(),
  ...new CommentsHandlers(gitService).toHandlerMap(),
  ...new SyncHandlers(ghService, syncService, indexer).toHandlerMap(),
  ...new ConnectivityHandlers(connectivity).toHandlerMap(),
  ...new LogHandlers().toHandlerMap(),
  ...new ExtensionsHandlers(
    extensionsService,
    extensionCatalogService,
    extensionInstallerService,
  ).toHandlerMap(),
  ...new GrammarsHandlers(extensionsService).toHandlerMap(),
  ...new SystemPreferenceHandlers().toHandlerMap(),
  ...new ThemeHandlers(extensionsService).toHandlerMap(),
  ...new LocalesHandlers(extensionsService).toHandlerMap(),
  ...new KeybindingsHandlers().toHandlerMap(),
  ...new ContextMenuHandlers().toHandlerMap(),
};
