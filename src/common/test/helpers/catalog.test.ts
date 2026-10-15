import { describe, expect, it } from 'vitest';
import type { CatalogEntry, ExtensionCatalog } from '../../extensions/catalog';
import { catalogAssetPlatform, findCatalogEntry } from '../../helpers/catalog';

const ENTRY: CatalogEntry = {
  name: 'gepard-ext-x',
  repository: 'o/r',
  path: 'extensions/lsp/x',
  displayName: 'x',
  kind: 'lsp',
  description: '',
  platforms: ['linux-x64'],
  sha: 'a'.repeat(40),
};

const CATALOG: ExtensionCatalog = [ENTRY, { ...ENTRY, name: 'other-x', repository: 'p/q' }];

describe('catalogAssetPlatform', () => {
  it('resolves the platform of a catalog entry, any when none are listed', () => {
    expect(catalogAssetPlatform(ENTRY, 'linux-x64')).toBe('linux-x64');
    expect(catalogAssetPlatform(ENTRY, 'win32-x64')).toBeNull();
    expect(catalogAssetPlatform({ ...ENTRY, platforms: undefined }, 'win32-x64')).toBe('any');
  });
});

describe('findCatalogEntry', () => {
  it('matches on repository and path together', () => {
    expect(findCatalogEntry(CATALOG, { owner: 'o', repo: 'r' }, 'extensions/lsp/x')).toBe(ENTRY);
    expect(findCatalogEntry(CATALOG, { owner: 'p', repo: 'q' }, 'extensions/lsp/x')?.name).toBe(
      'other-x',
    );
    expect(findCatalogEntry(CATALOG, { owner: 'o', repo: 'r' }, 'extensions/lsp/y')).toBeNull();
    expect(findCatalogEntry(CATALOG, { owner: 'o', repo: 'r' }, null)).toBeNull();
  });
});
