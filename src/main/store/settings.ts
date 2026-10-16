import { z } from 'zod';
import type { Paths } from '../main/paths';
import type { FileLockService } from '../services/fileLock';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';

const SettingsFile = z.object({
  theme: z.object({ templateId: z.string().nullable() }),
  // Defaulted because `readJsonFile` treats a schema mismatch as corruption, so older files must still parse.
  locale: z.object({ localeId: z.string().nullable() }).default({ localeId: null }),
  extensions: z.record(z.string(), z.boolean()),
  keybindings: z.record(z.string(), z.string()).default({}),
});
type SettingsFile = z.infer<typeof SettingsFile>;

const EMPTY_SETTINGS: SettingsFile = {
  theme: { templateId: null },
  locale: { localeId: null },
  extensions: {},
  keybindings: {},
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

  async setKeybindingOverride(id: string, key: string | null): Promise<KeybindingOverrides> {
    return this.update(async (settings) => {
      const keybindings = { ...settings.keybindings };
      if (key === null) delete keybindings[id];
      else keybindings[id] = key;
      await writeJsonFile(this.paths.settingsJsonPath(), { ...settings, keybindings });
      return keybindings;
    });
  }
}
