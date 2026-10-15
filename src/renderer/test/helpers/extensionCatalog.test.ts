import { describe, expect, it } from 'vitest';
import type { CatalogEntryStatus } from '@gepard/common';
import { catalogAction } from '../../src/helpers/extensionCatalog';

function entry(overrides: Partial<CatalogEntryStatus> = {}): CatalogEntryStatus {
  return {
    name: 'gepard-ext-demo',
    displayName: 'Demo',
    kind: 'lsp',
    description: '',
    repository: 'dee-gmiterko/gepard',
    path: 'extensions/lsp/demo',
    sha: 'a'.repeat(40),
    supported: true,
    installedVersion: null,
    installedSource: null,
    ...overrides,
  };
}

describe('catalogAction', () => {
  it('offers install or nothing depending on the installed state', () => {
    expect(catalogAction(entry())).toBe('install');
    expect(
      catalogAction(entry({ installedVersion: '0.2.0', installedSource: { kind: 'local' } })),
    ).toBe('upToDate');
  });

  it('never offers actions for built-in or unsupported entries', () => {
    expect(
      catalogAction(entry({ installedVersion: '0.1.0', installedSource: { kind: 'builtin' } })),
    ).toBe('builtin');
    expect(catalogAction(entry({ supported: false }))).toBe('unsupported');
    expect(
      catalogAction(
        entry({ supported: false, installedVersion: '0.1.0', installedSource: { kind: 'local' } }),
      ),
    ).toBe('unsupported');
  });
});
