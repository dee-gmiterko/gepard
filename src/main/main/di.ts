import { tmpdir } from 'node:os';
import { ExtensionCatalog } from '@gepard/common';
import catalogJson from '../../../extensions/catalog.json';
import type { Paths } from './paths';
import type { LoggerService } from './log';
import { FileLoggerService } from '../services/logger';
import { IpcEventService } from '../ipc/events';
import { LatestWinsService } from '../ipc/cancellation';
import type { HandlerMap } from '../ipc/dispatch';
import type { FolderPicker } from '../ports/native';
import type { InstanceLauncher } from '../ports/instanceLauncher';
import type { ContextMenuPort } from '../ports/contextMenuPort';
import { NotifyService } from './notify';
import { run, runBuffer, runJson } from '../helpers/process/exec';
import { FileLockService } from '../services/fileLock';
import { ProjectStore } from '../store/projects';
import { SettingsStore } from '../store/settings';
import { ExtensionsStore } from '../store/extensions';
import { ReviewStore } from '../store/review';
import { ConnectivityService } from '../services/connectivity';
import { GitClient } from '../clients/git';
import { GhClient } from '../clients/gh';
import { GhService } from '../services/gh';
import { GitService } from '../services/git';
import { SyncService } from '../services/sync';
import { LaunchService } from '../services/launch';
import type { SystemPreferenceService } from '../services/systemPreference';
import { KIND_SPECS } from '../extensions/kindSpecs';
import { DownloadService } from '../services/download';
import { ExtensionCatalogService } from '../services/extensionCatalog';
import { ExtensionInstallerService } from '../services/extensionInstaller';
import { ExtensionScannerService } from '../services/extensionScanner';
import { ExtensionsService } from '../services/extensions';
import { IndexerService } from '../lsp/indexer';
import { ProjectsHandlers } from '../ipc/handlers/projects';
import { LaunchHandlers } from '../ipc/handlers/launch';
import { PrsHandlers } from '../ipc/handlers/prs';
import { FilesHandlers } from '../ipc/handlers/files';
import { SearchHandlers } from '../ipc/handlers/search';
import { CommentsHandlers } from '../ipc/handlers/comments';
import { SyncHandlers } from '../ipc/handlers/sync';
import { ConnectivityHandlers } from '../ipc/handlers/connectivity';
import { LogHandlers } from '../ipc/handlers/log';
import { ExtensionsHandlers } from '../ipc/handlers/extensions';
import { GrammarsHandlers } from '../ipc/handlers/grammars';
import { SystemPreferenceHandlers } from '../ipc/handlers/systemPreference';
import { ThemeHandlers } from '../ipc/handlers/theme';
import { LocalesHandlers } from '../ipc/handlers/locales';
import { KeybindingsHandlers } from '../ipc/handlers/keybindings';
import { HiddenFilesHandlers } from '../ipc/handlers/hiddenFiles';
import { HiddenFilesService } from '../services/hiddenFiles';
import { ContextMenuHandlers } from '../ipc/handlers/contextMenu';

export interface Core {
  paths: Paths;
  logger: LoggerService;
  events: IpcEventService;
  notify: NotifyService;
  latestWins: LatestWinsService;
  fileLocks: FileLockService;
  projects: ProjectStore;
  settings: SettingsStore;
  extensionsStore: ExtensionsStore;
  review: ReviewStore;
  connectivity: ConnectivityService;
  ghService: GhService;
  gitService: GitService;
  syncService: SyncService;
  extensions: ExtensionsService;
  extensionCatalog: ExtensionCatalogService;
  extensionInstaller: ExtensionInstallerService;
  indexer: IndexerService;
  launch: LaunchService;
}

export interface CoreHost {
  target: string | null;
  builtinExtensionsDir: string;
  logToConsole: boolean;
  instances: (logger: LoggerService) => InstanceLauncher;
  focusWindow: () => void;
}

export function composeCore(paths: Paths, host: CoreHost): Core {
  const logger = new FileLoggerService(paths, host.logToConsole);
  const events = new IpcEventService();
  const notify = new NotifyService(logger, events);
  const latestWins = new LatestWinsService();
  const fileLocks = new FileLockService();
  const projects = new ProjectStore(paths, logger, fileLocks);
  const settings = new SettingsStore(paths, fileLocks);
  const extensionsStore = new ExtensionsStore(paths, fileLocks);
  const review = new ReviewStore(paths, fileLocks);
  const connectivity = new ConnectivityService(logger, events);
  const gitClient = new GitClient(connectivity, run, runBuffer);
  const ghClient = new GhClient(connectivity, run, runJson);
  const platformTarget = `${process.platform}-${process.arch}`;
  const extensionScanner = new ExtensionScannerService(
    paths.extensionsRootDir(),
    host.builtinExtensionsDir,
    KIND_SPECS,
    extensionsStore,
  );
  const extensions = new ExtensionsService(paths.extensionsRootDir(), settings, extensionScanner);
  const extensionCatalog = new ExtensionCatalogService(
    ExtensionCatalog.parse(catalogJson),
    extensions,
    platformTarget,
  );
  const downloads = new DownloadService(ghClient, tmpdir());
  const extensionInstaller = new ExtensionInstallerService(
    extensions,
    extensionCatalog,
    ghClient,
    downloads,
    platformTarget,
  );
  const indexer = new IndexerService(paths, logger, events, notify, extensions);
  const ghService = new GhService(ghClient, projects);
  const gitService = new GitService(paths, logger, events, indexer, gitClient, projects);
  const syncService = new SyncService(ghService, gitService, logger, review);
  const launch = new LaunchService(
    gitService,
    projects,
    indexer,
    events,
    notify,
    host.target,
    paths,
    logger,
    host.instances(logger),
    host.focusWindow,
  );
  return {
    paths,
    logger,
    events,
    notify,
    latestWins,
    fileLocks,
    projects,
    settings,
    extensionsStore,
    review,
    connectivity,
    ghService,
    gitService,
    syncService,
    extensions,
    extensionCatalog,
    extensionInstaller,
    indexer,
    launch,
  };
}

export function composeHandlers(
  core: Core,
  folderPicker: FolderPicker,
  contextMenu: ContextMenuPort,
  systemPreference: SystemPreferenceService,
): HandlerMap {
  const { ghService, gitService, review, indexer, extensions, settings } = core;
  const hiddenFiles = new HiddenFilesService(settings, core.projects);
  return {
    ...new ProjectsHandlers(ghService, gitService, core.projects, indexer).toHandlerMap(),
    ...new LaunchHandlers(core.launch).toHandlerMap(),
    ...new PrsHandlers(ghService, gitService, review, hiddenFiles).toHandlerMap(),
    ...new FilesHandlers(gitService, hiddenFiles).toHandlerMap(),
    ...new SearchHandlers(core.paths, indexer, core.latestWins).toHandlerMap(),
    ...new CommentsHandlers(gitService, review).toHandlerMap(),
    ...new SyncHandlers(ghService, core.syncService, review, indexer).toHandlerMap(),
    ...new ConnectivityHandlers(core.connectivity).toHandlerMap(),
    ...new LogHandlers(core.logger).toHandlerMap(),
    ...new ExtensionsHandlers(
      extensions,
      core.extensionCatalog,
      core.extensionInstaller,
      folderPicker,
    ).toHandlerMap(),
    ...new GrammarsHandlers(extensions).toHandlerMap(),
    ...new SystemPreferenceHandlers(systemPreference).toHandlerMap(),
    ...new ThemeHandlers(settings, extensions).toHandlerMap(),
    ...new LocalesHandlers(settings, extensions).toHandlerMap(),
    ...new KeybindingsHandlers(settings).toHandlerMap(),
    ...new HiddenFilesHandlers(settings, core.projects).toHandlerMap(),
    ...new ContextMenuHandlers(contextMenu).toHandlerMap(),
  };
}
