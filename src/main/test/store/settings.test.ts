import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeUserData, type UserData } from '../support/tmp';
import { SettingsStore } from '../../store/settings';
import { ExtensionsStore } from '../../store/extensions';
import { FileLockService } from '../../services/fileLock';
import {
  DEMO_GRAMMAR_BODY,
  DEMO_LANG_BODY,
  DEMO_THEME_BODY,
  writePackage,
} from '../support/extensionPackages';
import { KIND_SPECS } from '../../extensions/kindSpecs';
import { ExtensionScannerService } from '../../services/extensionScanner';
import { ExtensionsService } from '../../services/extensions';

describe('store/settings and known extension files', () => {
  let userData: UserData;
  let settings: SettingsStore;
  let extensionsStore: ExtensionsStore;

  beforeEach(async () => {
    userData = await makeUserData();
    const locks = new FileLockService();
    settings = new SettingsStore(userData.paths, locks);
    extensionsStore = new ExtensionsStore(userData.paths, locks);
  });

  function newService(): ExtensionsService {
    return new ExtensionsService(
      userData.paths.extensionsRootDir(),
      settings,
      new ExtensionScannerService(
        userData.paths.extensionsRootDir(),
        userData.builtinDir,
        KIND_SPECS,
        extensionsStore,
      ),
    );
  }

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
      await writePackage(builtin, 'b-lang', DEMO_LANG_BODY.replace('demo-lang', 'b-lang'));
      await writePackage(
        builtin,
        'b-theme',
        DEMO_THEME_BODY.replace("id: 'demo-theme'", "id: 'b-theme'"),
        { gepard: { type: 'theme' } },
      );
      await writePackage(
        builtin,
        'b-grammar',
        DEMO_GRAMMAR_BODY.replace('demo-grammar', 'b-grammar'),
        { gepard: { type: 'grammar' } },
      );
    }

    it('records a single kind in extensions-files.json', async () => {
      const builtin = userData.builtinDir;
      await writePackage(builtin, 'only-lang', DEMO_LANG_BODY.replace('demo-lang', 'only-lang'));
      await newService().list();
      const ids = Object.values(await extensionsStore.getKnownFiles()).map((k) => k.id);
      expect(ids).toEqual(['only-lang']);
    });

    it('records every kind scanned concurrently by list()', async () => {
      const builtin = userData.builtinDir;
      await writeBuiltins(builtin);
      await newService().list();
      const ids = Object.values(await extensionsStore.getKnownFiles()).map((k) => k.id);
      expect(ids.sort()).toEqual(['b-grammar', 'b-lang', 'b-theme']);
    });
  });
});
