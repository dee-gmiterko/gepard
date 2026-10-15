import { app } from 'electron';
import { ExtensionCatalog } from '@gepard/common';
import catalogJson from '../../extensions/catalog.json';
import { GhClient } from './clients/gh';
import { GitClient } from './clients/git';
import { cli } from './cli';
import { KindRegistry } from './extensions/kindRegistry';
import { GRAMMAR_SPEC, LOCALE_SPEC, LSP_SPEC, THEME_SPEC } from './extensions/kindSpecs';
import { run, runBuffer, runJson } from './helpers/process/exec';
import { emit } from './ipc/registry';
import { IndexerService } from './lsp/indexer';
import { builtinExtensionsDir, extensionsRootDir } from './paths';
import { ConnectivityService } from './services/connectivity';
import { ExtensionCatalogService } from './services/extensionCatalog';
import { ExtensionInstallerService } from './services/extensionInstaller';
import { ExtensionsService } from './services/extensions';
import { GhService } from './services/gh';
import { GitService } from './services/git';
import { LaunchService } from './services/launch';
import { SyncService } from './services/sync';
import { getProject } from './store/projects';

const platformTarget = `${process.platform}-${process.arch}`;

export const connectivity = new ConnectivityService((offline) =>
  emit('connectivity.changed', { offline }),
);

export const ghClient = new GhClient(connectivity, run, runJson);
export const gitClient = new GitClient(connectivity, run, runBuffer);

export const lspRegistry = new KindRegistry(LSP_SPEC, extensionsRootDir, builtinExtensionsDir);
export const grammarRegistry = new KindRegistry(
  GRAMMAR_SPEC,
  extensionsRootDir,
  builtinExtensionsDir,
);
export const themeRegistry = new KindRegistry(THEME_SPEC, extensionsRootDir, builtinExtensionsDir);
export const localeRegistry = new KindRegistry(
  LOCALE_SPEC,
  extensionsRootDir,
  builtinExtensionsDir,
);

export const extensionsService = new ExtensionsService(
  extensionsRootDir,
  lspRegistry,
  grammarRegistry,
  themeRegistry,
  localeRegistry,
);

export const extensionCatalogService = new ExtensionCatalogService(
  ExtensionCatalog.parse(catalogJson),
  extensionsService,
  platformTarget,
);

export const extensionInstallerService = new ExtensionInstallerService(
  extensionsService,
  extensionCatalogService,
  ghClient,
  platformTarget,
  () => app.getPath('temp'),
);

export const indexer = new IndexerService(extensionsService);

export const ghService = new GhService(getProject, ghClient);
export const gitService = new GitService(indexer, gitClient);
export const syncService = new SyncService(ghService, gitService);
export const launchService = new LaunchService(gitService, indexer, cli.target);
