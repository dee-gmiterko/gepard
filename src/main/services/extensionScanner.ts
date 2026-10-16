import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import {
  errorMessage,
  ExtensionKind,
  extensionModuleSchema,
  isErrnoException,
  type ExtensionSource,
  type PackageManifest,
} from '@gepard/common';
import type { KindSpec } from '../extensions/kindSpecs';
import { readManifest } from '../helpers/extension';
import type { ExtensionsStore, KnownFile, KnownFilesState } from '../store/extensions';
import type { ExtensionsState } from '../store/settings';

const LOADABLE_ENTRY_FILE = /\.(mjs|cjs|js)$/;

const BUILTIN: ExtensionSource = { kind: 'builtin' };
const LOCAL: ExtensionSource = { kind: 'local' };

export type ScanEntry =
  | {
      status: 'loaded';
      kind: ExtensionKind;
      id: string;
      displayName: string;
      extension: unknown;
      manifest: PackageManifest;
    }
  | {
      status: 'disabled';
      kind: ExtensionKind;
      id: string;
      displayName: string;
      manifest: PackageManifest;
    }
  | { status: 'failed'; kind?: ExtensionKind; error: string };

export type ScannedPackage = ScanEntry & { dir: string; source: ExtensionSource };

export interface LoadedExtensionPackage<T> {
  extension: T;
  dir: string;
  source: ExtensionSource;
  manifest: PackageManifest;
}

export function loadedOf<T>(
  packages: readonly ScannedPackage[],
  spec: KindSpec<T>,
): LoadedExtensionPackage<T>[] {
  const result: LoadedExtensionPackage<T>[] = [];
  for (const pkg of packages) {
    if (pkg.status === 'loaded' && pkg.kind === spec.kind && spec.isValid(pkg.extension)) {
      result.push({
        extension: pkg.extension,
        dir: pkg.dir,
        source: pkg.source,
        manifest: pkg.manifest,
      });
    }
  }
  return result;
}

export class ExtensionScannerService {
  private readonly cache = new Map<string, ScanEntry>();

  constructor(
    private readonly userDir: string,
    private readonly builtinDir: string,
    private readonly specs: readonly KindSpec<unknown>[],
    private readonly extensionsStore: ExtensionsStore,
  ) {}

  forget(dir: string): void {
    this.cache.delete(dir);
  }

  async scan(enabledMap: ExtensionsState): Promise<ScannedPackage[]> {
    const knownFiles = await this.extensionsStore.getKnownFiles();
    const packages = [
      ...(await this.scanRoot(this.builtinDir, BUILTIN, knownFiles, enabledMap)),
      ...(await this.scanRoot(this.userDir, LOCAL, knownFiles, enabledMap)),
    ];
    await this.persistKnownFiles(packages, knownFiles);
    return packages;
  }

  private async scanRoot(
    root: string,
    source: ExtensionSource,
    knownFiles: KnownFilesState,
    enabledMap: ExtensionsState,
  ): Promise<ScannedPackage[]> {
    let names: string[];
    try {
      names = (await readdir(root, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ENOENT') return [];
      return [{ status: 'failed', error: errorMessage(e), dir: root, source }];
    }
    const packages: ScannedPackage[] = [];
    for (const name of names) {
      const dir = path.join(root, name);
      const entry = await this.scanPackage(dir, knownFiles[dir], enabledMap);
      packages.push({ ...entry, dir, source });
    }
    return packages;
  }

  private async scanPackage(
    dir: string,
    known: KnownFile | undefined,
    enabledMap: ExtensionsState,
  ): Promise<ScanEntry> {
    const prior = this.cache.get(dir);
    if (prior && prior.status !== 'disabled') return prior;

    let manifest: PackageManifest;
    if (prior) {
      manifest = prior.manifest;
    } else {
      try {
        manifest = await readManifest(dir);
      } catch (e) {
        return this.remember(dir, { status: 'failed', error: errorMessage(e) });
      }
    }

    const type = manifest.gepard?.type;
    const spec = this.specs.find((s) => s.kind === type);
    if (!spec) {
      const kind = ExtensionKind.safeParse(type);
      return this.remember(dir, {
        status: 'failed',
        kind: kind.success ? kind.data : undefined,
        error: `package.json "gepard.type" is ${JSON.stringify(type ?? null)}, expected one of ${this.specs.map((s) => JSON.stringify(s.kind)).join(', ')}`,
      });
    }

    if (known && (known.kind ?? spec.kind) === spec.kind && !(enabledMap[known.id] ?? true)) {
      return this.remember(dir, {
        status: 'disabled',
        kind: spec.kind,
        id: known.id,
        displayName: known.displayName,
        manifest,
      });
    }

    try {
      const entryName = manifest.main ?? 'index.js';
      if (!LOADABLE_ENTRY_FILE.test(entryName)) {
        throw new Error(`package.json "main" (${entryName}) is not a .js/.mjs/.cjs file`);
      }
      const entryPath = path.join(dir, entryName);
      const mod: unknown = createRequire(entryPath)(entryPath);
      const exports = extensionModuleSchema.parse(mod);
      const candidate = exports.default ?? exports.extension ?? mod;
      if (!spec.isValid(candidate)) {
        return this.remember(dir, {
          status: 'failed',
          kind: spec.kind,
          error: `module does not export a valid "${spec.kind}" extension`,
        });
      }
      return this.remember(dir, {
        status: 'loaded',
        kind: spec.kind,
        id: spec.getId(candidate),
        displayName: spec.getDisplayName(candidate),
        extension: candidate,
        manifest,
      });
    } catch (e) {
      return this.remember(dir, { status: 'failed', kind: spec.kind, error: errorMessage(e) });
    }
  }

  private remember(dir: string, entry: ScanEntry): ScanEntry {
    this.cache.set(dir, entry);
    return entry;
  }

  private async persistKnownFiles(
    packages: readonly ScannedPackage[],
    known: KnownFilesState,
  ): Promise<void> {
    const next: KnownFilesState = {};
    let changed = false;
    for (const pkg of packages) {
      if (pkg.status !== 'loaded') continue;
      const prev = known[pkg.dir];
      if (
        !prev ||
        prev.id !== pkg.id ||
        prev.displayName !== pkg.displayName ||
        prev.kind !== pkg.kind
      ) {
        next[pkg.dir] = { id: pkg.id, displayName: pkg.displayName, kind: pkg.kind };
        changed = true;
      }
    }
    if (changed) await this.extensionsStore.mergeKnownFiles(next);
  }
}
