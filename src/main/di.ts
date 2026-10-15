import { app } from 'electron';
import { ExtensionCatalog } from '@gepard/common';
import catalogJson from '../../extensions/catalog.json';
import { ghClient } from './clients/gh';
import { builtinExtensionsDir, extensionsRootDir } from './paths';
import { ExtensionCatalogService } from './services/extensionCatalog';
import { ExtensionInstallerService } from './services/extensionInstaller';
import { ExtensionsService } from './services/extensions';

const platformTarget = `${process.platform}-${process.arch}`;

export const extensionsService = new ExtensionsService(extensionsRootDir, builtinExtensionsDir);

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
