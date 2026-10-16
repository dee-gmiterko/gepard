import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { languageIdOf } from '@gepard/common';
import { GRAMMAR_SPEC, KIND_SPECS, LSP_SPEC, THEME_SPEC } from '../../extensions/kindSpecs';
import { ExtensionScannerService, loadedOf } from '../../services/extensionScanner';
import { ExtensionsStore } from '../../store/extensions';
import { FileLockService } from '../../services/fileLock';
import {
  DEMO_GRAMMAR_BODY,
  DEMO_LANG_BODY,
  DEMO_THEME_BODY,
  writePackage,
} from '../support/extensionPackages';
import { makeUserData, type UserData } from '../support/tmp';

describe('ExtensionScannerService', () => {
  let dir: UserData;
  let root: string;
  let extensionsStore: ExtensionsStore;

  async function setup(): Promise<ExtensionScannerService> {
    dir = await makeUserData();
    extensionsStore = new ExtensionsStore(dir.paths, new FileLockService());
    root = join(dir.path, 'ext');
    return new ExtensionScannerService(
      root,
      join(dir.path, 'builtin'),
      KIND_SPECS,
      extensionsStore,
    );
  }

  afterEach(async () => {
    await dir?.cleanup();
  });

  it('returns nothing when the directories do not exist', async () => {
    const scanner = await setup();
    expect(await scanner.scan({})).toEqual([]);
  });

  it('loads a conforming package, reports a wrong-shaped one, and one that throws on import', async () => {
    const scanner = await setup();
    await writePackage(root, 'good', DEMO_LANG_BODY);
    await writePackage(root, 'bad-shape', `module.exports = { id: 'bad-shape' }`);
    await writePackage(root, 'throws', `throw new Error('boom during import')`);
    await mkdir(join(root, 'not-a-package'), { recursive: true });

    const packages = await scanner.scan({});
    const loaded = loadedOf(packages, LSP_SPEC);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].extension.id).toBe('demo-lang');
    expect(languageIdOf(loaded[0].extension.languages, 'a.demo')).toBe('demo');
    expect(loaded[0].dir).toBe(join(root, 'good'));
    expect(loaded[0].source).toEqual({ kind: 'local' });

    const failed = packages.flatMap((p) => (p.status === 'failed' ? [p] : []));
    expect(failed).toHaveLength(3);
    const byDir = new Map(failed.map((f) => [f.dir, f.error]));
    expect(byDir.get(join(root, 'bad-shape'))).toBe(
      'module does not export a valid "lsp" extension',
    );
    expect(byDir.get(join(root, 'throws'))).toContain('boom during import');
    expect(byDir.get(join(root, 'not-a-package'))).toContain('package.json');
  });

  it('reports an lsp package that does not export languages', async () => {
    const scanner = await setup();
    await writePackage(
      root,
      'no-language-id',
      `module.exports = { id: 'no-language-id', displayName: 'No Language Id', open: async () => ({}) }`,
    );

    const packages = await scanner.scan({});
    expect(loadedOf(packages, LSP_SPEC)).toEqual([]);
    expect(packages).toEqual([
      expect.objectContaining({
        status: 'failed',
        error: 'module does not export a valid "lsp" extension',
      }),
    ]);
  });

  it('dispatches every package of the one shared folder to its own kind in a single scan', async () => {
    const scanner = await setup();
    await writePackage(root, 'a-lang', DEMO_LANG_BODY);
    await writePackage(root, 'b-theme', DEMO_THEME_BODY, { gepard: { type: 'theme' } });
    await writePackage(root, 'c-grammar', DEMO_GRAMMAR_BODY, { gepard: { type: 'grammar' } });
    await writePackage(root, 'd-unknown', DEMO_LANG_BODY, { gepard: { type: 'nope' } });

    const packages = await scanner.scan({});

    expect(packages).toHaveLength(4);
    expect(loadedOf(packages, LSP_SPEC).map((p) => p.extension.id)).toEqual(['demo-lang']);
    expect(loadedOf(packages, THEME_SPEC).map((p) => p.extension.id)).toEqual(['demo-theme']);
    expect(loadedOf(packages, GRAMMAR_SPEC).map((p) => p.extension.id)).toEqual(['demo-grammar']);
    expect(packages[3]).toMatchObject({ status: 'failed' });
    expect(packages[3].status === 'failed' && packages[3].error).toContain('gepard.type');
  });

  it('reads and imports each package once per scan, however many kinds exist', async () => {
    const scanner = await setup();
    const counterFile = join(root, 'counter.txt');
    await mkdir(root, { recursive: true });
    await writeFile(counterFile, '');
    await writePackage(
      root,
      'broken',
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')\nthrow new Error('nope')`,
    );

    const packages = await scanner.scan({});
    expect(packages.filter((p) => p.status === 'failed')).toHaveLength(1);
    expect((await readFile(counterFile, 'utf8')).length).toBe(1);
  });

  it('never re-imports a path once scanned, so a fix on disk is not picked up', async () => {
    const scanner = await setup();
    const pkgDir = await writePackage(root, 'ext', `module.exports = { id: 'incomplete' }`);

    const first = await scanner.scan({});
    await writeFile(join(pkgDir, 'index.js'), DEMO_LANG_BODY);
    const second = await scanner.scan({});

    expect(first).toEqual([expect.objectContaining({ status: 'failed' })]);
    expect(second).toEqual(first);
  });

  it('never imports a package known to be disabled, and imports it once enabled', async () => {
    const scanner = await setup();
    const counterFile = join(dir.path, 'counter.txt');
    await writeFile(counterFile, '');
    const pkgDir = await writePackage(
      root,
      'ext',
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')\n${DEMO_LANG_BODY}`,
    );
    await extensionsStore.mergeKnownFiles({
      [pkgDir]: { id: 'demo-lang', displayName: 'Demo Lang', kind: 'lsp' },
    });

    const disabled = await scanner.scan({ 'demo-lang': false });
    expect(disabled).toEqual([
      expect.objectContaining({ status: 'disabled', id: 'demo-lang', kind: 'lsp' }),
    ]);
    expect((await readFile(counterFile, 'utf8')).length).toBe(0);

    const enabled = await scanner.scan({});
    expect(loadedOf(enabled, LSP_SPEC)).toHaveLength(1);
    expect((await readFile(counterFile, 'utf8')).length).toBe(1);
  });
});
