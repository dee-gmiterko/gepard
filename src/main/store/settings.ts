import type { Paths } from '../main/paths';
import type { FileLockService } from '../services/fileLock';
import { CURRENT_SETTINGS_VERSION, SettingsFile } from './settingsMigrations';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';

const EMPTY_SETTINGS: SettingsFile = {
  version: CURRENT_SETTINGS_VERSION,
  theme: { templateId: null },
  locale: { localeId: null },
  extensions: {},
  keybindings: {},
  hiddenFiles: [],
};

export type ExtensionsState = SettingsFile['extensions'];
export type KeybindingOverrides = SettingsFile['keybindings'];

export class SettingsStore {
  constructor(
    private readonly paths: Paths,
    private readonly locks: FileLockService,
  ) {}

  private update<T>(fn: (settings: SettingsFile) => Promise<T>): Promise<T> {
    return this.locks.withLock(this.paths.writeLockPath('settings'), async () =>
      fn(await this.read()),
    );
  }

  private async read(): Promise<SettingsFile> {
    return readJsonFile(this.paths.settingsJsonPath(), SettingsFile, () => EMPTY_SETTINGS);
  }

  async getTemplateId(): Promise<string | null> {
    return (await this.read()).theme.templateId;
  }

  async setTemplateId(templateId: string | null): Promise<string | null> {
    return this.update(async (settings) => {
      await writeJsonFile(this.paths.settingsJsonPath(), { ...settings, theme: { templateId } });
      return templateId;
    });
  }

  async getLocaleId(): Promise<string | null> {
    return (await this.read()).locale.localeId;
  }

  async setLocaleId(localeId: string | null): Promise<string | null> {
    return this.update(async (settings) => {
      await writeJsonFile(this.paths.settingsJsonPath(), { ...settings, locale: { localeId } });
      return localeId;
    });
  }

  async getEnabledMap(): Promise<ExtensionsState> {
    return (await this.read()).extensions;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    return this.update(async (settings) => {
      const extensions = { ...settings.extensions, [id]: enabled };
      await writeJsonFile(this.paths.settingsJsonPath(), { ...settings, extensions });
    });
  }

  async getKeybindingOverrides(): Promise<KeybindingOverrides> {
    return (await this.read()).keybindings;
  }

  async setKeybindingOverride(id: string, keys: string[] | null): Promise<KeybindingOverrides> {
    return this.update(async (settings) => {
      const keybindings = { ...settings.keybindings };
      if (keys === null) delete keybindings[id];
      else keybindings[id] = keys;
      await writeJsonFile(this.paths.settingsJsonPath(), { ...settings, keybindings });
      return keybindings;
    });
  }

  async getHiddenFiles(): Promise<string[]> {
    return (await this.read()).hiddenFiles;
  }

  async setHiddenFiles(hiddenFiles: string[]): Promise<string[]> {
    return this.update(async (settings) => {
      await writeJsonFile(this.paths.settingsJsonPath(), { ...settings, hiddenFiles });
      return hiddenFiles;
    });
  }
}
