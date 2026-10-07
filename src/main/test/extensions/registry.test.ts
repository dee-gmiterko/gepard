import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ExtensionRegistry } from '../../extensions/registry';
import * as settingsStore from '../../store/settings';
import {
  DEMO_GRAMMAR_BODY,
  DEMO_LANG_BODY,
  DEMO_THEME_BODY,
  writePackage,
} from '../support/extensionPackages';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

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
