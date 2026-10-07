import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';
import * as settings from '../store/settings';
import * as extensionsStore from '../store/extensions';
import { ExtensionRegistry } from '../extensions/registry';
import {
  DEMO_GRAMMAR_BODY,
  DEMO_LANG_BODY,
  DEMO_THEME_BODY,
  writePackage,
} from './support/extensionPackages';

describe('store/settings and known extension files', () => {
  let userData: TmpDir;

  beforeEach(async () => {
    userData = await makeTmpDir('store-settings');
    __setUserDataDir(userData.path);
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  it('returns defaults when nothing was saved', async () => {
    expect(await settings.getTemplateId()).toBeNull();
    expect(await settings.getLocaleId()).toBeNull();
    expect(await settings.getEnabledMap()).toEqual({});
    expect(await settings.getKeybindingOverrides()).toEqual({});
  });

  it('persists each setter sequentially without disturbing the others', async () => {
    await settings.setTemplateId('tpl');
    await settings.setLocaleId('cs');
    await settings.setEnabled('ext-a', false);
    await settings.setKeybindingOverride('act', 'ctrl+k');
    await settings.setKeybindingOverride('other', 'ctrl+j');
    await settings.setKeybindingOverride('other', null);
    expect(await settings.getTemplateId()).toBe('tpl');
    expect(await settings.getLocaleId()).toBe('cs');
    expect(await settings.getEnabledMap()).toEqual({ 'ext-a': false });
    expect(await settings.getKeybindingOverrides()).toEqual({ act: 'ctrl+k' });
  });

  it('keeps every update when different setters run concurrently', async () => {
    await Promise.all([
      settings.setTemplateId('tpl'),
      settings.setLocaleId('cs'),
      settings.setEnabled('ext-a', false),
      settings.setKeybindingOverride('act', 'ctrl+k'),
    ]);
    expect(await settings.getTemplateId()).toBe('tpl');
    expect(await settings.getLocaleId()).toBe('cs');
    expect(await settings.getEnabledMap()).toEqual({ 'ext-a': false });
    expect(await settings.getKeybindingOverrides()).toEqual({ act: 'ctrl+k' });
  });

  it('keeps every update when the same setter runs concurrently for different keys', async () => {
    await Promise.all([
      settings.setEnabled('a', false),
      settings.setEnabled('b', true),
      settings.setEnabled('c', false),
    ]);
    expect(await settings.getEnabledMap()).toEqual({ a: false, b: true, c: false });
  });

  describe('extension registry known files', () => {
    async function writeBuiltins(builtin: string): Promise<void> {
      await writePackage(
        join(builtin, 'lsp'),
        'b-lang',
        DEMO_LANG_BODY.replace('demo-lang', 'b-lang'),
      );
      await writePackage(
        join(builtin, 'themes'),
        'b-theme',
        DEMO_THEME_BODY.replace("id: 'demo-theme'", "id: 'b-theme'"),
        { gepard: { type: 'theme' } },
      );
      await writePackage(
        join(builtin, 'grammars'),
        'b-grammar',
        DEMO_GRAMMAR_BODY.replace('demo-grammar', 'b-grammar'),
        { gepard: { type: 'grammar' } },
      );
    }

    it('records a single kind in extensions-files.json', async () => {
      const builtin = join(userData.path, 'builtin');
      await writePackage(
        join(builtin, 'lsp'),
        'only-lang',
        DEMO_LANG_BODY.replace('demo-lang', 'only-lang'),
      );
      await new ExtensionRegistry(join(userData.path, 'ext'), builtin).list();
      const ids = Object.values(await extensionsStore.getKnownFiles()).map((k) => k.id);
      expect(ids).toEqual(['only-lang']);
    });

    it('records every kind scanned concurrently by list()', async () => {
      const builtin = join(userData.path, 'builtin');
      await writeBuiltins(builtin);
      await new ExtensionRegistry(join(userData.path, 'ext'), builtin).list();
      const ids = Object.values(await extensionsStore.getKnownFiles()).map((k) => k.id);
      expect(ids.sort()).toEqual(['b-grammar', 'b-lang', 'b-theme']);
    });
  });
});
