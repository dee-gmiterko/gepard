import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeUserData, type UserData } from '../support/tmp';
import { SettingsStore } from '../../store/settings';
import { FileLockService } from '../../services/fileLock';
import { CURRENT_SETTINGS_VERSION } from '../../store/settingsMigrations';

describe('store/settings migrations', () => {
  let userData: UserData;
  let settings: SettingsStore;

  beforeEach(async () => {
    userData = await makeUserData();
    settings = new SettingsStore(userData.paths, new FileLockService());
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  async function writeRaw(content: unknown): Promise<void> {
    const file = userData.paths.settingsJsonPath();
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  async function readRaw(): Promise<Record<string, unknown>> {
    return JSON.parse(await readFile(userData.paths.settingsJsonPath(), 'utf8')) as Record<
      string,
      unknown
    >;
  }

  it('migrates the unversioned file with single-string keybindings', async () => {
    await writeRaw({
      theme: { templateId: 'tpl' },
      extensions: { 'ext-a': false },
      keybindings: { act: 'Ctrl+K', other: 'Shift+J' },
    });
    expect(await settings.getKeybindingOverrides()).toEqual({
      act: ['Ctrl+K'],
      other: ['Shift+J'],
    });
    expect(await settings.getTemplateId()).toBe('tpl');
    expect(await settings.getLocaleId()).toBeNull();
    expect(await settings.getEnabledMap()).toEqual({ 'ext-a': false });
    expect(await settings.getHiddenFiles()).toEqual([]);
  });

  it('migrates an unversioned file without a keybindings field', async () => {
    await writeRaw({ theme: { templateId: null }, extensions: {} });
    expect(await settings.getKeybindingOverrides()).toEqual({});
  });

  it('writes the current version, with migrated keybindings, on the next save', async () => {
    await writeRaw({
      theme: { templateId: null },
      extensions: {},
      keybindings: { act: 'Ctrl+K' },
    });
    await settings.setKeybindingOverride('act', ['Ctrl+K', 'Gamepad:0']);
    const saved = await readRaw();
    expect(saved.version).toBe(CURRENT_SETTINGS_VERSION);
    expect(saved.keybindings).toEqual({ act: ['Ctrl+K', 'Gamepad:0'] });
  });

  it('reads a current-version file as is', async () => {
    await writeRaw({
      version: CURRENT_SETTINGS_VERSION,
      theme: { templateId: null },
      locale: { localeId: 'cs' },
      extensions: {},
      keybindings: { act: ['a', 'Gamepad:1'] },
      hiddenFiles: ['x'],
    });
    expect(await settings.getKeybindingOverrides()).toEqual({ act: ['a', 'Gamepad:1'] });
    expect(await settings.getLocaleId()).toBe('cs');
    expect(await settings.getHiddenFiles()).toEqual(['x']);
  });
});
