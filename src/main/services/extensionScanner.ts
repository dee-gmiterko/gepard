import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
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
import * as extensionsStore from '../store/extensions';
import type * as settingsStore from '../store/settings';

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

// Node never re-evaluates a module once it has imported its URL, whether that
// import succeeded or failed, so a package dir already scanned is never
// imported again.
export class ExtensionScannerService {
  private readonly cache = new Map<string, ScanEntry>();

  constructor(
    private readonly userDir: () => string,
    private readonly builtinDir: () => string,
    private readonly specs: readonly KindSpec<unknown>[],
  ) {}

  forget(dir: string): void {
    this.cache.delete(dir);
  }

  async scan(enabledMap: settingsStore.ExtensionsState): Promise<ScannedPackage[]> {
    const knownFiles = await extensionsStore.getKnownFiles();
    const packages = [
      ...(await this.scanRoot(this.builtinDir(), BUILTIN, knownFiles, enabledMap)),
      ...(await this.scanRoot(this.userDir(), LOCAL, knownFiles, enabledMap)),
    ];
    await this.persistKnownFiles(packages, knownFiles);
    return packages;
  }

  private async scanRoot(
    root: string,
    source: ExtensionSource,
    knownFiles: extensionsStore.KnownFilesState,
    enabledMap: settingsStore.ExtensionsState,
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
    known: extensionsStore.KnownFile | undefined,
    enabledMap: settingsStore.ExtensionsState,
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
      const mod: unknown = await import(pathToFileURL(path.join(dir, entryName)).href);
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
    known: extensionsStore.KnownFilesState,
  ): Promise<void> {
    const next: extensionsStore.KnownFilesState = {};
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
    if (changed) await extensionsStore.mergeKnownFiles(next);
  }
}
