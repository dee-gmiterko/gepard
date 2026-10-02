import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  errorMessage,
  extensionModuleSchema,
  isErrnoException,
  packageManifestSchema,
  type ExtensionSource,
  type PackageManifest,
} from '@gepard/common';
import * as extensionsStore from '../store/extensions';

const LOADABLE_ENTRY_FILE = /\.(mjs|cjs|js)$/;

export async function readManifest(pkgDir: string): Promise<PackageManifest> {
  const raw = await readFile(path.join(pkgDir, 'package.json'), 'utf8');
  const parsed = packageManifestSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error('package.json is not an object');
  return parsed.data;
}

export interface LoadedExtensionPackage<T> {
  extension: T;
  dir: string;
}

export interface FailedExtensionPackage {
  dir: string;
  error: string;
}

export interface DisabledExtensionPackage {
  dir: string;
  id: string;
  displayName: string;
}

export type Sourced<T> = T & { source: ExtensionSource };

export type ScanEntry<T> =
  { extension: T } | { error: string } | { disabled: extensionsStore.KnownFile };

export type ScanCache<T> = Map<string, ScanEntry<T>>;

// Node never re-evaluates a module once it has imported its URL, whether that
// import succeeded or failed, so a package dir already scanned is never
// imported again.
export async function loadExtensionPackages<T>(
  dir: string,
  kind: string,
  isValid: (value: unknown) => value is T,
  previous: ScanCache<T> = new Map(),
  knownDirs: ReadonlyMap<string, extensionsStore.KnownFile> = new Map(),
  isEnabled: (id: string) => boolean = () => true,
): Promise<{
  loaded: LoadedExtensionPackage<T>[];
  failed: FailedExtensionPackage[];
  disabled: DisabledExtensionPackage[];
  cache: ScanCache<T>;
}> {
  const loaded: LoadedExtensionPackage<T>[] = [];
  const failed: FailedExtensionPackage[] = [];
  const disabled: DisabledExtensionPackage[] = [];
  const cache: ScanCache<T> = new Map();

  let names: string[];
  try {
    names = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (e) {
    if (isErrnoException(e) && e.code === 'ENOENT') return { loaded, failed, disabled, cache };
    failed.push({ dir, error: errorMessage(e) });
    return { loaded, failed, disabled, cache };
  }

  for (const name of names) {
    const pkgDir = path.join(dir, name);

    const prior = previous.get(pkgDir);
    if (prior && 'extension' in prior) {
      cache.set(pkgDir, prior);
      loaded.push({ extension: prior.extension, dir: pkgDir });
      continue;
    }
    if (prior && 'error' in prior) {
      cache.set(pkgDir, prior);
      failed.push({ dir: pkgDir, error: prior.error });
      continue;
    }

    const known = prior && 'disabled' in prior ? prior.disabled : knownDirs.get(pkgDir);
    if (known && !isEnabled(known.id)) {
      const entry: ScanEntry<T> = { disabled: known };
      cache.set(pkgDir, entry);
      disabled.push({ dir: pkgDir, id: known.id, displayName: known.displayName });
      continue;
    }

    try {
      const manifest = await readManifest(pkgDir);
      if (manifest.gepard?.type !== kind) {
        throw new Error(
          `package.json "gepard.type" is ${JSON.stringify(manifest.gepard?.type ?? null)}, expected ${JSON.stringify(kind)}`,
        );
      }
      const entryName = manifest.main ?? 'index.js';
      if (!LOADABLE_ENTRY_FILE.test(entryName)) {
        throw new Error(`package.json "main" (${entryName}) is not a .js/.mjs/.cjs file`);
      }
      const entryPath = path.join(pkgDir, entryName);
      const mod: unknown = await import(pathToFileURL(entryPath).href);
      const exports = extensionModuleSchema.parse(mod);
      const candidate = exports.default ?? exports.extension ?? mod;
      if (!isValid(candidate)) {
        const entry: ScanEntry<T> = { error: `module does not export a valid "${kind}" extension` };
        cache.set(pkgDir, entry);
        failed.push({ dir: pkgDir, error: entry.error });
        continue;
      }
      const entry: ScanEntry<T> = { extension: candidate };
      cache.set(pkgDir, entry);
      loaded.push({ extension: candidate, dir: pkgDir });
    } catch (e) {
      const entry: ScanEntry<T> = { error: errorMessage(e) };
      cache.set(pkgDir, entry);
      failed.push({ dir: pkgDir, error: entry.error });
    }
  }
  return { loaded, failed, disabled, cache };
}
