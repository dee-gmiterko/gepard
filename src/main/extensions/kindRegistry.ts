import * as path from 'node:path';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import {
  errorMessage,
  isErrnoException,
  type ExtensionInfo,
  type ExtensionKind,
  type ExtensionSource,
  AppError,
} from '@gepard/common';
import { builtinExtensionsDir, userExtensionsDir, type ExtensionKindDir } from '../paths';
import * as extensionsStore from '../store/extensions';
import * as settingsStore from '../store/settings';
import {
  loadExtensionPackages,
  readManifest,
  type DisabledExtensionPackage,
  type FailedExtensionPackage,
  type LoadedExtensionPackage,
  type ScanCache,
  type Sourced,
} from '../extensions/scanner';

const BUILTIN: ExtensionSource = { kind: 'builtin' };
const LOCAL: ExtensionSource = { kind: 'local' };

export interface KindSpec<T> {
  kind: ExtensionKind;
  dirName: ExtensionKindDir;
  isValid: (value: unknown) => value is T;
  getId: (item: T) => string;
  getDisplayName: (item: T) => string;
}

interface KnownExtension<T> {
  extension: T;
  source: ExtensionSource;
  packageName?: string;
  version?: string;
}

export interface InstallOptions {
  dirName?: string;
  replacePackage?: string;
}

export class KindRegistry<T> {
  private builtin: LoadedExtensionPackage<T>[] = [];
  private external: LoadedExtensionPackage<T>[] = [];
  private failed: Sourced<FailedExtensionPackage>[] = [];
  private allDisabled: Sourced<DisabledExtensionPackage>[] = [];
  private builtinScanCache: ScanCache<T> = new Map();
  private externalScanCache: ScanCache<T> = new Map();

  constructor(
    private readonly spec: KindSpec<T>,
    private readonly overrideUserDir?: string,
    private readonly overrideBuiltinDir?: string,
  ) {}

  private get userDir(): string {
    return this.overrideUserDir ?? userExtensionsDir(this.spec.dirName);
  }

  private get builtinDir(): string {
    return this.overrideBuiltinDir ?? builtinExtensionsDir(this.spec.dirName);
  }

  private async rescan(enabledMap: settingsStore.ExtensionsState): Promise<void> {
    const knownDirs = await extensionsStore.getKnownFiles();
    const knownMap = new Map(Object.entries(knownDirs));

    const builtinResult = await loadExtensionPackages(
      this.builtinDir,
      this.spec.kind,
      this.spec.isValid,
      this.builtinScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true,
    );
    const externalResult = await loadExtensionPackages(
      this.userDir,
      this.spec.kind,
      this.spec.isValid,
      this.externalScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true,
    );

    this.builtin = builtinResult.loaded;
    this.external = externalResult.loaded;
    this.failed = [
      ...builtinResult.failed.map((f) => ({ ...f, source: BUILTIN })),
      ...externalResult.failed.map((f) => ({ ...f, source: LOCAL })),
    ];
    this.allDisabled = [
      ...builtinResult.disabled.map((d) => ({ ...d, source: BUILTIN })),
      ...externalResult.disabled.map((d) => ({ ...d, source: LOCAL })),
    ];
    this.builtinScanCache = builtinResult.cache;
    this.externalScanCache = externalResult.cache;
    await this.persistKnownDirs([...builtinResult.loaded, ...externalResult.loaded], knownDirs);
  }

  private async persistKnownDirs(
    loaded: LoadedExtensionPackage<T>[],
    known: extensionsStore.KnownFilesState,
  ): Promise<void> {
    if (loaded.length === 0) return;
    const next: extensionsStore.KnownFilesState = {};
    let changed = false;
    for (const { extension, dir } of loaded) {
      const id = this.spec.getId(extension);
      const displayName = this.spec.getDisplayName(extension);
      const prev = known[dir];
      if (!prev || prev.id !== id || prev.displayName !== displayName) {
        next[dir] = { id, displayName };
        changed = true;
      }
    }
    if (changed) await extensionsStore.mergeKnownFiles(next);
  }

  private known(): KnownExtension<T>[] {
    const describe =
      (source: ExtensionSource) =>
      ({ extension, manifest }: LoadedExtensionPackage<T>): KnownExtension<T> => ({
        extension,
        source,
        packageName: manifest.name,
        version: manifest.version,
      });
    return [...this.builtin.map(describe(BUILTIN)), ...this.external.map(describe(LOCAL))];
  }

  async list(): Promise<ExtensionInfo[]> {
    const enabledMap = await settingsStore.getEnabledMap();
    await this.rescan(enabledMap);
    const known = this.known().map(
      ({ extension, source, packageName, version }): ExtensionInfo => ({
        id: this.spec.getId(extension),
        displayName: this.spec.getDisplayName(extension),
        kind: this.spec.kind,
        source,
        enabled: enabledMap[this.spec.getId(extension)] ?? true,
        packageName,
        version,
      }),
    );
    const broken = this.failed.map(({ dir, error, source }): ExtensionInfo => ({
      id: dir,
      displayName: path.basename(dir),
      kind: this.spec.kind,
      source,
      enabled: false,
      error,
    }));
    const disabled = await Promise.all(
      this.allDisabled.map(async ({ id, displayName, source, dir }): Promise<ExtensionInfo> => {
        const manifest = await readManifest(dir).catch(() => undefined);
        return {
          id,
          displayName,
          kind: this.spec.kind,
          source,
          enabled: false,
          packageName: manifest?.name,
          version: manifest?.version,
        };
      }),
    );
    return [...known, ...broken, ...disabled];
  }

  private async removeExternalPackage(packageName: string): Promise<void> {
    let names: string[];
    try {
      names = (await readdir(this.userDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ENOENT') return;
      throw e;
    }
    for (const name of names) {
      const dir = path.join(this.userDir, name);
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
      this.externalScanCache.delete(dir);
    }
  }

  async install(srcDir: string, options: InstallOptions = {}): Promise<void> {
    const name = options.dirName ?? path.basename(srcDir);
    await mkdir(this.userDir, { recursive: true });
    if (options.replacePackage !== undefined) {
      await this.removeExternalPackage(options.replacePackage);
      await rm(path.join(this.userDir, name), { recursive: true, force: true });
    }
    try {
      await cp(srcDir, path.join(this.userDir, name), {
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

  async enabledPackages(): Promise<LoadedExtensionPackage<T>[]> {
    const enabledMap = await settingsStore.getEnabledMap();
    await this.rescan(enabledMap);
    return [...this.builtin, ...this.external].filter(
      ({ extension }) => enabledMap[this.spec.getId(extension)] ?? true,
    );
  }

  async enabledExtensions(): Promise<T[]> {
    return (await this.enabledPackages()).map(({ extension }) => extension);
  }
}
