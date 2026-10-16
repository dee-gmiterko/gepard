import { describe, expect, it } from 'vitest';
import { buildCatalog, buildReleaseConfig, type ExtensionPackage } from '../helpers/catalog';

const PACKAGES: ExtensionPackage[] = [
  {
    path: 'extensions/lsp/typescript',
    manifest: {
      name: 'gepard-ext-typescript',
      version: '0.1.0',
      description: 'TypeScript LSP',
      gepard: { type: 'lsp', displayName: 'TypeScript', platforms: ['linux-x64'] },
    },
  },
  {
    path: 'extensions/themes/dark',
    manifest: { name: 'gepard-theme-dark', version: '0.2.0', gepard: { type: 'theme' } },
  },
];

describe('buildCatalog', () => {
  it('lists every extension with its repository, path and tree sha and omits platforms when unrestricted', () => {
    const catalog = buildCatalog(PACKAGES, 'o/r', (dir) => `sha:${dir}`);
    expect(catalog).toEqual([
      {
        name: 'gepard-ext-typescript',
        repository: 'o/r',
        path: 'extensions/lsp/typescript',
        displayName: 'TypeScript',
        kind: 'lsp',
        description: 'TypeScript LSP',
        platforms: ['linux-x64'],
        sha: 'sha:extensions/lsp/typescript',
      },
      {
        name: 'gepard-theme-dark',
        repository: 'o/r',
        path: 'extensions/themes/dark',
        displayName: 'gepard-theme-dark',
        kind: 'theme',
        description: '',
        sha: 'sha:extensions/themes/dark',
      },
    ]);
    expect(Object.keys(catalog[1])).not.toContain('platforms');
  });
});

describe('buildReleaseConfig', () => {
  it('replaces the extension packages and keeps the rest of the config', () => {
    const existing = {
      'release-type': 'node',
      packages: {
        '.': { 'exclude-paths': ['extensions'] },
        'extensions/lsp/removed': { component: 'gepard-ext-removed' },
      },
      'separate-pull-requests': true,
    };
    const config = buildReleaseConfig(existing, PACKAGES);
    expect(Object.keys(config)).toEqual(['release-type', 'packages', 'separate-pull-requests']);
    expect(Object.keys(config.packages)).toEqual([
      '.',
      'extensions/lsp/typescript',
      'extensions/themes/dark',
    ]);
    expect(config.packages['extensions/themes/dark']).toEqual({
      component: 'gepard-theme-dark',
      'include-component-in-tag': true,
    });
  });
});
