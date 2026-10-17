import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import {
  AppError,
  errorMessage,
  isErrnoException,
  type ExtensionInfo,
  type ExtensionKind,
  type GrammarModule,
  type LanguageExtension,
  type PackageManifest,
  type LocaleExtension,
  type ThemeExtension,
} from '@gepard/common';
import {
  GRAMMAR_SPEC,
  KIND_SPECS,
  LOCALE_SPEC,
  LSP_SPEC,
  THEME_SPEC,
  type KindSpec,
} from '../extensions/kindSpecs';
import { readManifest } from '../helpers/extension';
import type { SettingsStore } from '../store/settings';
import {
  loadedOf,
  type ExtensionScannerService,
  type LoadedExtensionPackage,
  type ScannedPackage,
} from './extensionScanner';

const FALLBACK_KIND: ExtensionKind = 'lsp';

// The app needs at least one of each of these to render and translate.
const REQUIRED_KINDS: readonly ExtensionKind[] = ['theme', 'locale'];

function describePackage(pkg: ScannedPackage): ExtensionInfo {
  switch (pkg.status) {
    case 'loaded':
      return {
        id: pkg.id,
        displayName: pkg.displayName,
        kind: pkg.kind,
        source: pkg.source,
        enabled: true,
        packageName: pkg.manifest.name,
        version: pkg.manifest.version,
      };
    case 'disabled':
      return {
        id: pkg.id,
        displayName: pkg.displayName,
        kind: pkg.kind,
        source: pkg.source,
        enabled: false,
        packageName: pkg.manifest.name,
        version: pkg.manifest.version,
      };
    case 'failed':
      return {
        id: pkg.dir,
        displayName: path.basename(pkg.dir),
        kind: pkg.kind ?? FALLBACK_KIND,
        source: pkg.source,
        enabled: false,
        error: pkg.error,
      };
  }
}

export class ExtensionsService {
  constructor(
    readonly userDir: string,
    private readonly settings: SettingsStore,
    private readonly scanner: ExtensionScannerService,
  ) {}

  async list(): Promise<ExtensionInfo[]> {
    const enabledMap = await this.settings.getEnabledMap();
    const packages = await this.scanner.scan(enabledMap);
    return packages.map((pkg) =>
      pkg.status === 'loaded'
        ? { ...describePackage(pkg), enabled: enabledMap[pkg.id] ?? true }
        : describePackage(pkg),
    );
  }

  private async enabledPackages<T>(spec: KindSpec<T>): Promise<LoadedExtensionPackage<T>[]> {
    const enabledMap = await this.settings.getEnabledMap();
    const packages = await this.scanner.scan(enabledMap);
    return loadedOf(packages, spec).filter(
      ({ extension }) => enabledMap[spec.getId(extension)] ?? true,
    );
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionInfo[]> {
    if (!enabled) {
      const current = await this.list();
      const target = current.find((ext) => ext.id === id);
      if (
        target?.enabled &&
        REQUIRED_KINDS.includes(target.kind) &&
        !current.some((ext) => ext.id !== id && ext.kind === target.kind && ext.enabled)
      ) {
        throw new AppError(
          'FORBIDDEN',
          `The last enabled ${target.kind} extension cannot be disabled`,
        );
      }
    }
    await this.settings.setEnabled(id, enabled);
    return this.list();
  }

  async install(
    srcDir: string,
    dirName?: string,
    replacePackage?: string,
  ): Promise<ExtensionInfo[]> {
    const name = path.basename(srcDir);
    let manifest: PackageManifest;
    try {
      manifest = await readManifest(srcDir);
    } catch (e) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}" has no valid package.json (${errorMessage(e)})`,
      );
    }
    const type = manifest.gepard?.type;
    if (!KIND_SPECS.some((spec) => spec.kind === type)) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}"'s package.json must set "gepard": { "type": "lsp" | "grammar" | "theme" | "locale" } (got ${JSON.stringify(type ?? null)})`,
      );
    }
    await this.copyPackage(srcDir, dirName, replacePackage);
    return this.list();
  }

  private async copyPackage(
    srcDir: string,
    dirName: string | undefined,
    replacePackage: string | undefined,
  ): Promise<void> {
    const userDir = this.userDir;
    const name = dirName ?? path.basename(srcDir);
    await mkdir(userDir, { recursive: true });
    if (replacePackage !== undefined) {
      await this.removePackage(userDir, replacePackage);
      await rm(path.join(userDir, name), { recursive: true, force: true });
      this.forget(path.join(userDir, name));
    }
    try {
      await cp(srcDir, path.join(userDir, name), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ERR_FS_CP_EEXIST') {
        throw new AppError(
          'EXTENSION_ALREADY_EXISTS',
          `An extension named "${name}" already exists.`,
        );
      }
      throw e;
    }
  }

  private async removePackage(userDir: string, packageName: string): Promise<void> {
    let names: string[];
    try {
      names = (await readdir(userDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ENOENT') return;
      throw e;
    }
    for (const name of names) {
      const dir = path.join(userDir, name);
      let installedName: string | undefined;
      try {
        installedName = (await readManifest(dir)).name;
      } catch {
        continue;
      }
      if (installedName !== packageName) continue;
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (e) {
        throw new AppError(
          'EXTENSION_IN_USE',
          `"${name}" could not be removed (${errorMessage(e)}); restart Gepard and try again.`,
        );
      }
      this.forget(dir);
    }
  }

  private forget(dir: string): void {
    this.scanner.forget(dir);
  }

  async enabledLanguageExtensions(): Promise<LanguageExtension[]> {
    return (await this.enabledPackages(LSP_SPEC)).map(({ extension }) => extension);
  }

  async enabledGrammars(): Promise<GrammarModule[]> {
    const packages = await this.enabledPackages(GRAMMAR_SPEC);
    return Promise.all(
      packages.map(async ({ extension, dir }) => {
        const manifest = await readManifest(dir);
        const source = await readFile(path.join(dir, manifest.main ?? 'index.js'), 'utf8');
        return {
          id: extension.id,
          displayName: extension.displayName,
          languages: extension.languages,
          source,
        };
      }),
    );
  }

  async enabledThemeTemplates(): Promise<ThemeExtension[]> {
    return (await this.enabledPackages(THEME_SPEC)).map(({ extension }) => extension);
  }

  async enabledLocales(): Promise<LocaleExtension[]> {
    return (await this.enabledPackages(LOCALE_SPEC)).map(({ extension }) => extension);
  }
}
