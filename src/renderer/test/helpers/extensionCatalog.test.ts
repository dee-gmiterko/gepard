import { describe, expect, it } from 'vitest';
import type { CatalogEntryStatus } from '@gepard/common';
import { catalogAction, isRepositoryInputValid } from '../../src/helpers/extensionCatalog';

function entry(overrides: Partial<CatalogEntryStatus> = {}): CatalogEntryStatus {
  return {
    name: 'gepard-ext-demo',
    displayName: 'Demo',
    kind: 'lsp',
    description: '',
    repository: 'dee-gmiterko/gepard',
    path: 'extensions/lsp/demo',
    latestVersion: '0.2.0',
    supported: true,
    installedVersion: null,
    installedSource: null,
    updateAvailable: false,
    ...overrides,
  };
}

describe('catalogAction', () => {
  it('offers install, update or nothing depending on the installed state', () => {
    expect(catalogAction(entry())).toBe('install');
    expect(
      catalogAction(
        entry({ installedVersion: '0.1.0', installedSource: 'external', updateAvailable: true }),
      ),
    ).toBe('update');
    expect(catalogAction(entry({ installedVersion: '0.2.0', installedSource: 'external' }))).toBe(
      'upToDate',
    );
  });

  it('never offers actions for built-in or unsupported entries', () => {
    expect(catalogAction(entry({ installedVersion: '0.1.0', installedSource: 'builtin' }))).toBe(
      'builtin',
    );
    expect(catalogAction(entry({ supported: false }))).toBe('unsupported');
    expect(
      catalogAction(
        entry({ supported: false, installedVersion: '0.1.0', installedSource: 'external' }),
      ),
    ).toBe('unsupported');
  });
});

describe('isRepositoryInputValid', () => {
  it('accepts owner/repo in plain or URL form', () => {
    expect(isRepositoryInputValid('dee-gmiterko/gepard')).toBe(true);
    expect(isRepositoryInputValid(' https://github.com/dee-gmiterko/gepard.git ')).toBe(true);
    expect(isRepositoryInputValid('')).toBe(false);
    expect(isRepositoryInputValid('gepard')).toBe(false);
    expect(isRepositoryInputValid('a/b/c')).toBe(false);
  });
});
