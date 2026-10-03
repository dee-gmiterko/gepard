import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadExtensionPackages } from '../extensions/scanner';
import {
  isGrammarExtension,
  isLanguageExtension,
  isThemeExtension,
  languageIdOf,
} from '@gepard/common';
import {
  DEMO_GRAMMAR_BODY,
  DEMO_LANG_BODY,
  DEMO_THEME_BODY,
  writePackage,
} from './support/extensionPackages';
import { makeTmpDir, type TmpDir } from './support/tmp';

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
