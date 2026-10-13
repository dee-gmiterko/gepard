import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  buildReleaseConfig,
  mergeReleaseManifest,
  type ExtensionPackage,
} from '../refresh-catalog';

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
  it('lists every extension with its tree sha and omits platforms when unrestricted', () => {
    const catalog = buildCatalog(PACKAGES, 'o/r', (dir) => `sha:${dir}`);
    expect(catalog).toEqual({
      schemaVersion: 1,
      repository: 'o/r',
      extensions: {
        'gepard-ext-typescript': {
          displayName: 'TypeScript',
          kind: 'lsp',
          description: 'TypeScript LSP',
          path: 'extensions/lsp/typescript',
          version: '0.1.0',
          platforms: ['linux-x64'],
          sha: 'sha:extensions/lsp/typescript',
        },
        'gepard-theme-dark': {
          displayName: 'gepard-theme-dark',
          kind: 'theme',
          description: '',
          path: 'extensions/themes/dark',
          version: '0.2.0',
          sha: 'sha:extensions/themes/dark',
        },
      },
    });
    expect(Object.keys(catalog.extensions['gepard-theme-dark'])).not.toContain('platforms');
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
      'extra-files': [
        {
          type: 'json',
          path: '/extensions/catalog.json',
          jsonpath: "$.extensions['gepard-theme-dark'].version",
        },
      ],
    });
  });
});

describe('mergeReleaseManifest', () => {
  it('adds missing extensions at their package version without touching released ones', () => {
    expect(
      mergeReleaseManifest({ '.': '1.0.0', 'extensions/lsp/typescript': '0.0.9' }, PACKAGES),
    ).toEqual({
      '.': '1.0.0',
      'extensions/lsp/typescript': '0.0.9',
      'extensions/themes/dark': '0.2.0',
    });
  });
});
