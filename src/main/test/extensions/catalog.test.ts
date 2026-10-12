import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  isNewerVersion,
  parseRepositoryInput,
  normalizeRepoPath,
  pickReleaseAsset,
  catalogAssetPlatform,
  releaseArchiveName,
  releaseTag,
  type ExtensionInfo,
} from '@gepard/common';
import { builtinCatalog, catalogStatus, loadCatalog, parseCatalog } from '../../extensions/catalog';

const REMOTE = JSON.stringify({
  schemaVersion: 1,
  repository: 'dee-gmiterko/gepard',
  extensions: {
    'gepard-ext-typescript': {
      displayName: 'TypeScript',
      kind: 'lsp',
      description: 'ts',
      path: 'extensions/lsp/typescript',
      version: '0.2.0',
      platforms: ['linux-x64', 'darwin-arm64'],
    },
    'gepard-ext-python': {
      displayName: 'Python',
      kind: 'lsp',
      description: 'py',
      path: 'extensions/lsp/python',
      version: '0.1.0',
      platforms: ['any'],
    },
  },
});

function installed(
  packageName: string,
  version: string,
  source: 'builtin' | 'external',
): ExtensionInfo {
  return {
    id: packageName,
    displayName: packageName,
    kind: 'lsp',
    source,
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

describe('parseRepositoryInput', () => {
  it('accepts owner/repo and GitHub URLs', () => {
    expect(parseRepositoryInput('dee-gmiterko/gepard')).toEqual({
      owner: 'dee-gmiterko',
      repo: 'gepard',
    });
    expect(parseRepositoryInput(' https://github.com/dee-gmiterko/gepard.git/ ')).toEqual({
      owner: 'dee-gmiterko',
      repo: 'gepard',
    });
    expect(parseRepositoryInput('github.com/a/b')).toEqual({ owner: 'a', repo: 'b' });
  });

  it('rejects other shapes', () => {
    expect(() => parseRepositoryInput('gepard')).toThrow(/expected <owner>\/<repo>/);
    expect(() => parseRepositoryInput('a/b/c')).toThrow();
    expect(() => parseRepositoryInput('a/b c')).toThrow();
  });

  it('normalizes repository paths', () => {
    expect(normalizeRepoPath(' /extensions/lsp/csharp/ ')).toBe('extensions/lsp/csharp');
    expect(normalizeRepoPath('')).toBeNull();
    expect(normalizeRepoPath(null)).toBeNull();
    expect(() => normalizeRepoPath('../x')).toThrow(/invalid repository path/);
  });
});

describe('release assets', () => {
  it('names tags and archives', () => {
    expect(releaseTag('gepard-ext-csharp', '0.1.2')).toBe('gepard-ext-csharp-v0.1.2');
    expect(releaseArchiveName('gepard-ext-csharp', '0.1.2', 'linux-x64')).toBe(
      'gepard-ext-csharp-v0.1.2-linux-x64.tar.gz',
    );
  });

  it('prefers the exact platform, then "any"', () => {
    const assets = [
      'gepard-ext-x-v1.0.0-any.tar.gz',
      'gepard-ext-x-v1.0.0-linux-x64.tar.gz',
      'gepard-ext-x-v1.0.0-linux-x64.tar.gz.sha256',
      'notes.txt',
    ];
    expect(pickReleaseAsset(assets, 'linux-x64')).toBe('gepard-ext-x-v1.0.0-linux-x64.tar.gz');
    expect(pickReleaseAsset(assets, 'win32-arm64')).toBe('gepard-ext-x-v1.0.0-any.tar.gz');
    expect(pickReleaseAsset(['gepard-ext-x-v1.0.0-darwin-x64.tar.gz'], 'linux-x64')).toBeNull();
  });

  it('resolves the platform of a catalog entry', () => {
    const entry = {
      displayName: 'x',
      kind: 'lsp' as const,
      description: '',
      path: 'p',
      version: '1.0.0',
      platforms: ['linux-x64'],
    };
    expect(catalogAssetPlatform(entry, 'linux-x64')).toBe('linux-x64');
    expect(catalogAssetPlatform(entry, 'win32-x64')).toBeNull();
    expect(catalogAssetPlatform({ ...entry, platforms: ['any'] }, 'win32-x64')).toBe('any');
  });
});

describe('catalog', () => {
  it('bundles a valid catalog that matches the repository', () => {
    expect(builtinCatalog.repository).toBe('dee-gmiterko/gepard');
    expect(Object.keys(builtinCatalog.extensions)).toContain('gepard-ext-typescript');
  });

  it('parses a remote catalog and rejects malformed ones', () => {
    expect(Object.keys(parseCatalog(REMOTE).extensions)).toEqual([
      'gepard-ext-typescript',
      'gepard-ext-python',
    ]);
    expect(() => parseCatalog('{')).toThrow(/not valid JSON/);
    expect(() => parseCatalog('{"schemaVersion":2}')).toThrow(/unexpected shape/);
  });

  it('uses the remote catalog when it loads and the bundled copy otherwise', async () => {
    const remote = await loadCatalog(
      () => Promise.resolve(REMOTE),
      'https://example.invalid/catalog.json',
    );
    expect(remote.source).toBe('remote');
    expect(remote.catalog.extensions['gepard-ext-typescript'].version).toBe('0.2.0');

    const fallback = await loadCatalog(() => Promise.reject(new Error('offline')));
    expect(fallback.source).toBe('builtin');
    expect(fallback.error).toBe('offline');
    expect(fallback.catalog).toBe(builtinCatalog);

    const invalid = await loadCatalog(() => Promise.resolve('nope'));
    expect(invalid.source).toBe('builtin');
  });

  it('joins catalog entries with installed extensions', () => {
    const entries = catalogStatus(
      parseCatalog(REMOTE),
      [installed('gepard-ext-typescript', '0.1.0', 'external')],
      'linux-x64',
    );
    expect(entries).toEqual([
      expect.objectContaining({
        name: 'gepard-ext-typescript',
        latestVersion: '0.2.0',
        installedVersion: '0.1.0',
        installedSource: 'external',
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
      parseCatalog(REMOTE),
      [
        installed('gepard-ext-typescript', '0.1.0', 'builtin'),
        installed('gepard-ext-typescript', '0.1.5', 'external'),
      ],
      'win32-x64',
    );
    expect(entries[0]).toEqual(
      expect.objectContaining({
        supported: false,
        installedSource: 'builtin',
        installedVersion: '0.1.0',
        updateAvailable: false,
      }),
    );
  });
});
