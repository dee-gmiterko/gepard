import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadExtensionPackages } from '../extensions/scanner';
import { ExtensionRegistry } from '../extensions/registry';
import {
  isGrammarExtension,
  isLanguageExtension,
  isThemeExtension,
  languageIdOf,
} from '@gepard/common';
import * as settingsStore from '../store/settings';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';

async function writePackage(
  root: string,
  name: string,
  body: string,
  manifestOverrides: Record<string, unknown> = {},
): Promise<string> {
  const pkgDir = join(root, name);
  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      main: 'index.js',
      gepard: { type: 'lsp' },
      ...manifestOverrides,
    }),
  );
  await writeFile(join(pkgDir, 'index.js'), body);
  return pkgDir;
}

const DEMO_LANG_BODY = `module.exports = {
  id: 'demo-lang',
  displayName: 'Demo Lang',
  languages: [{ name: 'demo', extensions: ['demo'] }],
  open: async () => ({
    lineSymbols: async () => [],
    definition: async () => [],
    references: async () => [],
    workspaceSymbols: async () => [],
    documentSymbols: async () => [],
    filesChanged: () => {},
    dispose: async () => {},
  })
}`;

const DEMO_GRAMMAR_BODY = `module.exports = {
  id: 'demo-grammar',
  displayName: 'Demo Grammar',
  languages: [{ name: 'Demo', extensions: ['demo'], filenames: ['Demofile'] }],
  support: (api) => api.StreamLanguage.define({ token: (s) => { s.skipToEnd(); return 'keyword'; } })
}`;

const THEME_COLOR_KEYS = [
  'bg',
  'bgSubtle',
  'bgElevated',
  'bgHover',
  'bgSelected',
  'fg',
  'fgMuted',
  'fgSubtle',
  'border',
  'borderStrong',
  'accent',
  'accentFg',
  'danger',
  'success',
  'warning',
  'diffAddBg',
  'diffAddFg',
  'diffDelBg',
  'diffDelFg',
  'diffHunk',
  'commentBg',
  'overlay',
];
const THEME_SYNTAX_KEYS = [
  'keyword',
  'string',
  'number',
  'comment',
  'type',
  'function',
  'property',
  'constant',
  'tag',
  'invalid',
];

const DEMO_THEME_BODY = `const colorKeys = ${JSON.stringify(THEME_COLOR_KEYS)}
const syntaxKeys = ${JSON.stringify(THEME_SYNTAX_KEYS)}
module.exports = {
  id: 'demo-theme',
  name: 'Demo Theme',
  mode: 'dark',
  shadow: { popover: '0 0 0', floating: '0 0 0' },
  colors: Object.fromEntries(colorKeys.map((k) => [k, '#000000'])),
  syntax: Object.fromEntries(syntaxKeys.map((k) => [k, '#000000']))
}`;

describe('loadExtensionPackages', () => {
  let dir: TmpDir;

  afterEach(async () => {
    await dir?.cleanup();
  });

  it('returns empty loaded/failed when the directory does not exist', async () => {
    const result = await loadExtensionPackages(
      '/nonexistent/path/for/sure',
      'lsp',
      isLanguageExtension,
    );
    expect(result.loaded).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.cache.size).toBe(0);
  });

  it('loads a conforming package, reports a wrong-shaped one, and one that throws on import', async () => {
    dir = await makeTmpDir('ext-scan');

    await writePackage(dir.path, 'good', DEMO_LANG_BODY);
    await writePackage(dir.path, 'bad-shape', `module.exports = { id: 'bad-shape' }`);
    await writePackage(dir.path, 'throws', `throw new Error('boom during import')`);
    await mkdir(join(dir.path, 'not-a-package'), { recursive: true });

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].extension.id).toBe('demo-lang');
    expect(languageIdOf(loaded[0].extension.languages, 'a.demo')).toBe('demo');
    expect(loaded[0].dir).toBe(join(dir.path, 'good'));

    expect(failed).toHaveLength(3);
    const byDir = new Map(failed.map((f) => [f.dir, f.error]));
    expect(byDir.get(join(dir.path, 'bad-shape'))).toBe(
      'module does not export a valid "lsp" extension',
    );
    expect(byDir.get(join(dir.path, 'throws'))).toContain('boom during import');
    expect(byDir.get(join(dir.path, 'not-a-package'))).toContain('package.json');
  });

  it('reports an lsp package that does not export languages', async () => {
    dir = await makeTmpDir('ext-scan-no-language-id');
    await writePackage(
      dir.path,
      'no-language-id',
      `module.exports = {
  id: 'no-language-id',
  displayName: 'No Language Id',
  open: async () => ({})
}`,
    );

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension);
    expect(loaded).toEqual([]);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('module does not export a valid "lsp" extension');
  });

  it('reports a package whose manifest "gepard.type" does not match the requested kind', async () => {
    dir = await makeTmpDir('ext-scan-wrong-type');
    await writePackage(dir.path, 'a-theme', DEMO_LANG_BODY, { gepard: { type: 'theme' } });

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension);
    expect(loaded).toEqual([]);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toContain('gepard.type');
  });

  it('loads a grammar package, and rejects one whose languages have no extensions', async () => {
    dir = await makeTmpDir('ext-scan-grammar');
    await writePackage(dir.path, 'demo-grammar', DEMO_GRAMMAR_BODY, {
      gepard: { type: 'grammar' },
    });
    await writePackage(
      dir.path,
      'no-extensions',
      `module.exports = { id: 'x', displayName: 'X', languages: [{ name: 'X', extensions: [] }], support: () => null }`,
      { gepard: { type: 'grammar' } },
    );

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'grammar', isGrammarExtension);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].extension.id).toBe('demo-grammar');
    expect(loaded[0].extension.languages[0].extensions).toEqual(['demo']);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('module does not export a valid "grammar" extension');
  });

  it('loads a theme package with the same scanner, keyed off "theme" instead of "lsp"', async () => {
    dir = await makeTmpDir('ext-scan-theme');
    await writePackage(dir.path, 'demo-theme', DEMO_THEME_BODY, { gepard: { type: 'theme' } });

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'theme', isThemeExtension);
    expect(failed).toEqual([]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].extension.id).toBe('demo-theme');
    expect(loaded[0].extension.mode).toBe('dark');
  });

  it('never re-imports a path once it has succeeded, threading the cache through repeated scans', async () => {
    dir = await makeTmpDir('ext-scan-once');
    const counterFile = join(dir.path, 'counter.txt');
    await writeFile(counterFile, '');
    await writePackage(
      dir.path,
      'ext',
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')\n${DEMO_LANG_BODY}`,
    );

    const first = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension);
    expect(first.loaded).toHaveLength(1);
    expect((await readFile(counterFile, 'utf8')).length).toBe(1);

    const second = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension, first.cache);
    expect(second.loaded).toHaveLength(1);
    expect(second.loaded[0].extension).toBe(first.loaded[0].extension);
    expect((await readFile(counterFile, 'utf8')).length).toBe(1);
  });

  it('keeps reporting a failed path as failed on a later scan, since a fix on disk is never re-imported', async () => {
    dir = await makeTmpDir('ext-scan-stale-failure');
    const pkgDir = await writePackage(dir.path, 'ext', `module.exports = { id: 'incomplete' }`);

    const first = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension);
    expect(first.loaded).toHaveLength(0);
    expect(first.failed).toHaveLength(1);

    await writeFile(join(pkgDir, 'index.js'), DEMO_LANG_BODY);
    const second = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension, first.cache);
    expect(second.loaded).toHaveLength(0);
    expect(second.failed).toHaveLength(1);
    expect(second.failed[0].error).toBe(first.failed[0].error);
  });

  it('never imports a package already known to be disabled', async () => {
    dir = await makeTmpDir('ext-scan-disabled-skip');
    const counterFile = join(dir.path, 'counter.txt');
    await writeFile(counterFile, '');
    const pkgDir = await writePackage(
      dir.path,
      'ext',
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')\n${DEMO_LANG_BODY}`,
    );

    const known = new Map([[pkgDir, { id: 'demo-lang', displayName: 'Demo Lang' }]]);
    const result = await loadExtensionPackages(
      dir.path,
      'lsp',
      isLanguageExtension,
      new Map(),
      known,
      () => false,
    );

    expect(result.loaded).toEqual([]);
    expect(result.disabled).toEqual([{ dir: pkgDir, id: 'demo-lang', displayName: 'Demo Lang' }]);
    expect((await readFile(counterFile, 'utf8')).length).toBe(0);
  });

  it('re-checks enabled state on every scan, so a known package is imported as soon as it is enabled', async () => {
    dir = await makeTmpDir('ext-scan-disabled-then-enabled');
    const pkgDir = await writePackage(dir.path, 'ext', DEMO_LANG_BODY);
    const known = new Map([[pkgDir, { id: 'demo-lang', displayName: 'Demo Lang' }]]);

    const first = await loadExtensionPackages(
      dir.path,
      'lsp',
      isLanguageExtension,
      new Map(),
      known,
      () => false,
    );
    expect(first.loaded).toEqual([]);
    expect(first.disabled).toHaveLength(1);

    const second = await loadExtensionPackages(
      dir.path,
      'lsp',
      isLanguageExtension,
      first.cache,
      known,
      () => true,
    );
    expect(second.disabled).toEqual([]);
    expect(second.loaded).toHaveLength(1);
    expect(second.loaded[0].extension.id).toBe('demo-lang');
  });
});

function themeBody(id: string, name: string, mode: 'light' | 'dark'): string {
  return DEMO_THEME_BODY.replace("id: 'demo-theme'", `id: '${id}'`)
    .replace("name: 'Demo Theme'", `name: '${name}'`)
    .replace("mode: 'dark'", `mode: '${mode}'`);
}

const BUILTIN_LOCALE_BODY = `module.exports = {
  id: 'builtin-en',
  displayName: 'Built-in English',
  messages: { greeting: 'Hello' }
}`;

async function writeBuiltins(root: string): Promise<void> {
  await writePackage(
    join(root, 'lsp'),
    'builtin-lang',
    DEMO_LANG_BODY.replace('demo-lang', 'builtin-lang').replace('Demo Lang', 'Built-in Lang'),
  );
  await writePackage(
    join(root, 'themes'),
    'builtin-light',
    themeBody('builtin-light', 'Built-in Light', 'light'),
    { gepard: { type: 'theme' } },
  );
  await writePackage(
    join(root, 'themes'),
    'builtin-dark',
    themeBody('builtin-dark', 'Built-in Dark', 'dark'),
    { gepard: { type: 'theme' } },
  );
  await writePackage(join(root, 'locales'), 'builtin-en', BUILTIN_LOCALE_BODY, {
    gepard: { type: 'locale' },
  });
  await writePackage(
    join(root, 'grammars'),
    'builtin-grammar',
    DEMO_GRAMMAR_BODY.replace('demo-grammar', 'builtin-grammar').replace(
      'Demo Grammar',
      'Built-in Grammar',
    ),
    { gepard: { type: 'grammar' } },
  );
}

describe('ExtensionRegistry', () => {
  let userData: TmpDir;
  let extRoot: string;
  let builtinRoot: string;

  async function setup(prefix: string): Promise<ExtensionRegistry> {
    userData = await makeTmpDir(prefix);
    __setUserDataDir(userData.path);
    extRoot = join(userData.path, 'extensions');
    builtinRoot = join(userData.path, 'builtin');
    await writeBuiltins(builtinRoot);
    return new ExtensionRegistry(extRoot, builtinRoot);
  }

  afterEach(async () => {
    await userData?.cleanup();
  });

  it('lists the built-in lsp, theme, and locale packages, enabled by default, with no extensions directory', async () => {
    const registry = await setup('ext-registry-builtin');
    const list = await registry.list();

    expect(list).toEqual(
      expect.arrayContaining([
        {
          id: 'builtin-lang',
          displayName: 'Built-in Lang',
          kind: 'lsp',
          source: 'builtin',
          enabled: true,
        },
        {
          id: 'builtin-light',
          displayName: 'Built-in Light',
          kind: 'theme',
          source: 'builtin',
          enabled: true,
        },
        {
          id: 'builtin-dark',
          displayName: 'Built-in Dark',
          kind: 'theme',
          source: 'builtin',
          enabled: true,
        },
        {
          id: 'builtin-en',
          displayName: 'Built-in English',
          kind: 'locale',
          source: 'builtin',
          enabled: true,
        },
        {
          id: 'builtin-grammar',
          displayName: 'Built-in Grammar',
          kind: 'grammar',
          source: 'builtin',
          enabled: true,
        },
      ]),
    );

    const languageExtensions = await registry.enabledLanguageExtensions();
    expect(languageExtensions.map((e) => e.id)).toEqual(['builtin-lang']);

    const grammars = await registry.enabledGrammars();
    expect(grammars).toHaveLength(1);
    expect(grammars[0]).toMatchObject({
      id: 'builtin-grammar',
      displayName: 'Built-in Grammar',
      languages: [{ name: 'Demo', extensions: ['demo'], filenames: ['Demofile'] }],
    });
    expect(grammars[0].source).toContain("id: 'builtin-grammar'");

    const themeTemplates = await registry.enabledThemeTemplates();
    expect(themeTemplates.map((t) => t.id).sort()).toEqual(['builtin-dark', 'builtin-light']);

    const locales = await registry.enabledLocales();
    expect(locales.map((l) => l.id)).toEqual(['builtin-en']);
  });

  it('setEnabled(false) persists per id and is reflected by list() and the enabled*() accessors', async () => {
    const registry = await setup('ext-registry-disable');
    const updated = await registry.setEnabled('builtin-dark', false);
    const darkEntry = updated.find((e) => e.id === 'builtin-dark');
    expect(darkEntry).toEqual({
      id: 'builtin-dark',
      displayName: 'Built-in Dark',
      kind: 'theme',
      source: 'builtin',
      enabled: false,
    });

    const reopened = new ExtensionRegistry(extRoot, builtinRoot);
    expect((await reopened.enabledThemeTemplates()).map((t) => t.id)).toEqual(['builtin-light']);
    expect((await reopened.enabledLanguageExtensions()).map((e) => e.id)).toEqual(['builtin-lang']);
    expect((await settingsStore.getEnabledMap())['builtin-dark']).toBe(false);
  });

  it('picks up an external package of either kind dropped into its own extensions/<kind> directory', async () => {
    const registry = await setup('ext-registry-external');
    await writePackage(join(extRoot, 'lsp'), 'demo', DEMO_LANG_BODY);
    await writePackage(join(extRoot, 'themes'), 'demo-theme', DEMO_THEME_BODY, {
      gepard: { type: 'theme' },
    });

    const list = await registry.list();
    expect(list).toEqual(
      expect.arrayContaining([
        {
          id: 'demo-lang',
          displayName: 'Demo Lang',
          kind: 'lsp',
          source: 'external',
          enabled: true,
        },
        {
          id: 'demo-theme',
          displayName: 'Demo Theme',
          kind: 'theme',
          source: 'external',
          enabled: true,
        },
      ]),
    );

    const languageIds = (await registry.enabledLanguageExtensions()).map((e) => e.id).sort();
    expect(languageIds).toEqual(['builtin-lang', 'demo-lang']);
    const themeIds = (await registry.enabledThemeTemplates()).map((t) => t.id).sort();
    expect(themeIds).toEqual(['builtin-dark', 'builtin-light', 'demo-theme']);

    await registry.setEnabled('demo-theme', false);
    expect((await registry.enabledThemeTemplates()).map((t) => t.id).sort()).toEqual([
      'builtin-dark',
      'builtin-light',
    ]);
  });

  it('lists a broken external package as an unresolvable, disabled entry without affecting the others', async () => {
    const registry = await setup('ext-registry-broken');
    await writePackage(join(extRoot, 'lsp'), 'broken', `throw new Error('nope')`);

    const list = await registry.list();

    const builtinEntry = list.find((e) => e.id === 'builtin-lang');
    expect(builtinEntry).toMatchObject({ kind: 'lsp', source: 'builtin', enabled: true });
    const brokenEntry = list.find((e) => e.source === 'external');
    expect(brokenEntry).toMatchObject({ kind: 'lsp', enabled: false });
    expect(brokenEntry?.error).toContain('nope');
  });

  it('installs a package folder into the extensions/<kind> directory matching its manifest', async () => {
    const registry = await setup('ext-registry-install');
    const source = await makeTmpDir('ext-registry-install-src');
    try {
      const lspPkgDir = await writePackage(source.path, 'demo', DEMO_LANG_BODY);
      const themePkgDir = await writePackage(source.path, 'demo-theme', DEMO_THEME_BODY, {
        gepard: { type: 'theme' },
      });

      const afterLsp = await registry.install(lspPkgDir);
      expect(afterLsp).toEqual(
        expect.arrayContaining([
          {
            id: 'demo-lang',
            displayName: 'Demo Lang',
            kind: 'lsp',
            source: 'external',
            enabled: true,
          },
        ]),
      );
      const afterTheme = await registry.install(themePkgDir);
      expect(afterTheme).toEqual(
        expect.arrayContaining([
          {
            id: 'demo-theme',
            displayName: 'Demo Theme',
            kind: 'theme',
            source: 'external',
            enabled: true,
          },
        ]),
      );

      const grammarPkgDir = await writePackage(source.path, 'demo-grammar', DEMO_GRAMMAR_BODY, {
        gepard: { type: 'grammar' },
      });
      const afterGrammar = await registry.install(grammarPkgDir);
      expect(afterGrammar).toEqual(
        expect.arrayContaining([
          {
            id: 'demo-grammar',
            displayName: 'Demo Grammar',
            kind: 'grammar',
            source: 'external',
            enabled: true,
          },
        ]),
      );
      expect((await registry.enabledGrammars()).map((g) => g.id).sort()).toEqual([
        'builtin-grammar',
        'demo-grammar',
      ]);

      await expect(registry.install(lspPkgDir)).rejects.toThrow(/already exists/);
    } finally {
      await source.cleanup();
    }
  });

  it('rejects installing a package whose manifest has no valid "gepard.type"', async () => {
    const registry = await setup('ext-registry-install-invalid');
    const source = await makeTmpDir('ext-registry-install-invalid-src');
    try {
      const pkgDir = await writePackage(source.path, 'demo', DEMO_LANG_BODY, {
        gepard: { type: 'not-a-kind' },
      });

      await expect(registry.install(pkgDir)).rejects.toThrow(/gepard/);
    } finally {
      await source.cleanup();
    }
  });

  it('rescans on every list()/enabled*() call, so a newly dropped package is picked up without restarting', async () => {
    const registry = await setup('ext-registry-rescan');
    expect((await registry.list()).map((e) => e.id).sort()).toEqual([
      'builtin-dark',
      'builtin-en',
      'builtin-grammar',
      'builtin-lang',
      'builtin-light',
    ]);

    await writePackage(
      join(extRoot, 'lsp'),
      'late',
      `module.exports = {
      id: 'late-lang',
      displayName: 'Late Lang',
      languages: [{ name: 'late', extensions: ['late'] }],
      open: async () => ({})
    }`,
    );

    const ids = (await registry.list()).map((e) => e.id).sort();
    expect(ids).toEqual([
      'builtin-dark',
      'builtin-en',
      'builtin-grammar',
      'builtin-lang',
      'builtin-light',
      'late-lang',
    ]);
  });
});
