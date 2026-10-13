import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  compareVersions,
  isNewerVersion,
  normalizeRepoPath,
  pickReleaseAsset,
  catalogAssetPlatform,
  releaseArchiveName,
  releaseTag,
  type CatalogEntry,
  type ExtensionInfo,
} from '@gepard/common';
import { catalogStatus, extensionCatalog } from '../../extensions/catalog';

const EXTENSIONS_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'extensions');

const ENTRY: CatalogEntry = {
  displayName: 'x',
  kind: 'lsp',
  description: '',
  path: 'extensions/lsp/x',
  version: '1.0.0',
  platforms: ['linux-x64'],
  sha: 'a'.repeat(40),
};

const CATALOG = {
  schemaVersion: 1 as const,
  repository: 'dee-gmiterko/gepard',
  extensions: {
    'gepard-ext-typescript': {
      ...ENTRY,
      displayName: 'TypeScript',
      path: 'extensions/lsp/typescript',
      version: '0.2.0',
      platforms: ['linux-x64', 'darwin-arm64'],
    },
    'gepard-ext-python': {
      ...ENTRY,
      displayName: 'Python',
      path: 'extensions/lsp/python',
      version: '0.1.0',
      platforms: undefined,
    },
  },
};

function installed(
  packageName: string,
  version: string,
  source: 'builtin' | 'local',
): ExtensionInfo {
  return {
    id: packageName,
    displayName: packageName,
    kind: 'lsp',
    source: { kind: source },
    enabled: true,
    packageName,
    version,
  };
}

describe('compareVersions', () => {
  it('orders numeric parts', () => {
    expect(compareVersions('0.1.0', '0.1.1')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });

  it('ranks prereleases below releases and compares identifiers', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareVersions('1.0.0-rc.1', '1.0.0-rc')).toBe(1);
    expect(compareVersions('1.0.0+build.5', '1.0.0')).toBe(0);
    expect(isNewerVersion('0.1.1', '0.1.0')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
  });
});

describe('normalizeRepoPath', () => {
  it('trims slashes and rejects traversal', () => {
    expect(normalizeRepoPath(' /extensions/lsp/csharp/ ')).toBe('extensions/lsp/csharp');
    expect(normalizeRepoPath('')).toBeNull();
    expect(normalizeRepoPath(null)).toBeNull();
    expect(() => normalizeRepoPath('../x')).toThrow(/invalid repository path/);
  });
});

describe('release assets', () => {
  it('names tags and npm tarballs', () => {
    expect(releaseTag('gepard-ext-csharp', '0.1.2')).toBe('gepard-ext-csharp-v0.1.2');
    expect(releaseArchiveName('gepard-ext-csharp', '0.1.2', 'linux-x64')).toBe(
      'gepard-ext-csharp-0.1.2-linux-x64.tgz',
    );
    expect(releaseArchiveName('gepard-theme-dark', '0.1.2', 'any')).toBe(
      'gepard-theme-dark-0.1.2.tgz',
    );
    expect(releaseArchiveName('@scope/ext', '1.0.0', 'any')).toBe('scope-ext-1.0.0.tgz');
  });

  it('prefers the exact platform, then the platform-independent tarball', () => {
    const assets = [
      'gepard-ext-x-1.0.0.tgz',
      'gepard-ext-x-1.0.0-linux-x64.tgz',
      'gepard-ext-x-1.0.0-linux-x64.tgz.sha256',
      'notes.txt',
    ];
    expect(pickReleaseAsset(assets, 'linux-x64')).toBe('gepard-ext-x-1.0.0-linux-x64.tgz');
    expect(pickReleaseAsset(assets, 'win32-arm64')).toBe('gepard-ext-x-1.0.0.tgz');
    expect(pickReleaseAsset(['gepard-ext-x-1.0.0-darwin-x64.tgz'], 'linux-x64')).toBeNull();
    expect(pickReleaseAsset(['gepard-ext-x-1.0.0-rc-1.tgz'], 'linux-x64')).toBe(
      'gepard-ext-x-1.0.0-rc-1.tgz',
    );
  });

  it('resolves the platform of a catalog entry, any when none are listed', () => {
    expect(catalogAssetPlatform(ENTRY, 'linux-x64')).toBe('linux-x64');
    expect(catalogAssetPlatform(ENTRY, 'win32-x64')).toBeNull();
    expect(catalogAssetPlatform({ ...ENTRY, platforms: undefined }, 'win32-x64')).toBe('any');
  });
});

describe('catalog', () => {
  it('is packaged with the app and lists every extension in the repository', () => {
    expect(extensionCatalog.repository).toBe('dee-gmiterko/gepard');
    const names = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
      .filter((kind) => kind.isDirectory())
      .flatMap((kind) =>
        readdirSync(join(EXTENSIONS_DIR, kind.name), { withFileTypes: true })
          .filter((ext) => ext.isDirectory() && !ext.name.startsWith('.'))
          .map((ext) => {
            const file = join(EXTENSIONS_DIR, kind.name, ext.name, 'package.json');
            return z.object({ name: z.string() }).parse(JSON.parse(readFileSync(file, 'utf8')))
              .name;
          }),
      )
      .sort();
    expect(Object.keys(extensionCatalog.extensions).sort()).toEqual(names);
  });

  it('joins catalog entries with installed extensions', () => {
    const entries = catalogStatus(
      CATALOG,
      [installed('gepard-ext-typescript', '0.1.0', 'local')],
      'linux-x64',
    );
    expect(entries).toEqual([
      expect.objectContaining({
        name: 'gepard-ext-typescript',
        latestVersion: '0.2.0',
        sha: 'a'.repeat(40),
        installedVersion: '0.1.0',
        installedSource: { kind: 'local' },
        supported: true,
        updateAvailable: true,
        repository: 'dee-gmiterko/gepard',
      }),
      expect.objectContaining({
        name: 'gepard-ext-python',
        installedVersion: null,
        installedSource: null,
        supported: true,
        updateAvailable: false,
      }),
    ]);
  });

  it('marks unsupported platforms and never offers updates for built-ins', () => {
    const entries = catalogStatus(
      CATALOG,
      [
        installed('gepard-ext-typescript', '0.1.0', 'builtin'),
        installed('gepard-ext-typescript', '0.1.5', 'local'),
      ],
      'win32-x64',
    );
    expect(entries[0]).toEqual(
      expect.objectContaining({
        supported: false,
        installedSource: { kind: 'builtin' },
        installedVersion: '0.1.0',
        updateAvailable: false,
      }),
    );
  });
});
