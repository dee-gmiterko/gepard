import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ExtensionCatalog, type ExtensionInfo } from '@gepard/common';
import { catalogStatus } from '../../helpers/catalog';
import catalogJson from '../../../../extensions/catalog.json';

const EXTENSIONS_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'extensions');

const CATALOG = ExtensionCatalog.parse({
  schemaVersion: 1,
  extensions: [
    {
      name: 'gepard-ext-typescript',
      repository: 'dee-gmiterko/gepard',
      path: 'extensions/lsp/typescript',
      displayName: 'TypeScript',
      kind: 'lsp',
      description: '',
      platforms: ['linux-x64', 'darwin-arm64'],
      sha: 'a'.repeat(40),
    },
    {
      name: 'gepard-ext-python',
      repository: 'dee-gmiterko/gepard',
      path: 'extensions/lsp/python',
      displayName: 'Python',
      kind: 'lsp',
      description: '',
      sha: 'b'.repeat(40),
    },
  ],
});

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

describe('catalog', () => {
  it('is packaged with the app and lists every extension in the repository', () => {
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
    const catalog = ExtensionCatalog.parse(catalogJson);
    expect(catalog.extensions.map((e) => e.name).sort()).toEqual(names);
    expect(new Set(catalog.extensions.map((e) => e.repository))).toEqual(
      new Set(['dee-gmiterko/gepard']),
    );
  });
});

describe('catalogStatus', () => {
  it('joins catalog entries with installed extensions', () => {
    const entries = catalogStatus(
      CATALOG,
      [installed('gepard-ext-typescript', '0.1.0', 'local')],
      'linux-x64',
    );
    expect(entries).toEqual([
      expect.objectContaining({
        name: 'gepard-ext-typescript',
        sha: 'a'.repeat(40),
        installedVersion: '0.1.0',
        installedSource: { kind: 'local' },
        supported: true,
        repository: 'dee-gmiterko/gepard',
        path: 'extensions/lsp/typescript',
      }),
      expect.objectContaining({
        name: 'gepard-ext-python',
        installedVersion: null,
        installedSource: null,
        supported: true,
      }),
    ]);
  });

  it('marks unsupported platforms and prefers the built-in installation', () => {
    const entries = catalogStatus(
      CATALOG,
      [
        installed('gepard-ext-typescript', '0.1.5', 'local'),
        installed('gepard-ext-typescript', '0.1.0', 'builtin'),
      ],
      'win32-x64',
    );
    expect(entries[0]).toEqual(
      expect.objectContaining({
        supported: false,
        installedSource: { kind: 'builtin' },
        installedVersion: '0.1.0',
      }),
    );
  });
});
