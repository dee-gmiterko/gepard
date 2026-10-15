import * as path from 'node:path';
import type { ExtensionInfo, ExtensionKind, ExtensionSource } from '@gepard/common';
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
} from './scanner';

const BUILTIN: ExtensionSource = { kind: 'builtin' };
const LOCAL: ExtensionSource = { kind: 'local' };

export interface KindSpec<T> {
  kind: ExtensionKind;
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

export class KindRegistry<T> {
  private builtin: LoadedExtensionPackage<T>[] = [];
  private external: LoadedExtensionPackage<T>[] = [];
  private failed: Sourced<FailedExtensionPackage>[] = [];
  private allDisabled: Sourced<DisabledExtensionPackage>[] = [];
  private builtinScanCache: ScanCache<T> = new Map();
  private externalScanCache: ScanCache<T> = new Map();

  constructor(
    private readonly spec: KindSpec<T>,
    private readonly userDir: () => string,
    private readonly builtinDir: () => string,
  ) {}

  get kind(): ExtensionKind {
    return this.spec.kind;
  }

  private async rescan(enabledMap: settingsStore.ExtensionsState): Promise<void> {
    const knownDirs = await extensionsStore.getKnownFiles();
    const knownMap = new Map(Object.entries(knownDirs));

    const builtinResult = await loadExtensionPackages(
      this.builtinDir(),
      this.spec.kind,
      this.spec.isValid,
      this.builtinScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true,
    );
    const externalResult = await loadExtensionPackages(
      this.userDir(),
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
      if (
        !prev ||
        prev.id !== id ||
        prev.displayName !== displayName ||
        prev.kind !== this.spec.kind
      ) {
        next[dir] = { id, displayName, kind: this.spec.kind };
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

  forget(dir: string): void {
    this.externalScanCache.delete(dir);
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
