import { z } from 'zod';
import { settingsJsonPath, writeLockPath } from '../paths';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';
import { withFileLock } from '../helpers/fileLock';

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

function updateSettings<T>(fn: (settings: SettingsFile) => Promise<T>): Promise<T> {
  return withFileLock(writeLockPath('settings'), async () => fn(await readSettings()));
}

async function readSettings(): Promise<SettingsFile> {
  return readJsonFile(settingsJsonPath(), SettingsFile, () => EMPTY_SETTINGS);
}

export async function getTemplateId(): Promise<string | null> {
  const settings = await readSettings();
  return settings.theme.templateId;
}

export async function setTemplateId(templateId: string | null): Promise<string | null> {
  return updateSettings(async (settings) => {
    await writeJsonFile(settingsJsonPath(), { ...settings, theme: { templateId } });
    return templateId;
  });
}

export async function getLocaleId(): Promise<string | null> {
  const settings = await readSettings();
  return settings.locale.localeId;
}

export async function setLocaleId(localeId: string | null): Promise<string | null> {
  return updateSettings(async (settings) => {
    await writeJsonFile(settingsJsonPath(), { ...settings, locale: { localeId } });
    return localeId;
  });
}

export type ExtensionsState = SettingsFile['extensions'];

export async function getEnabledMap(): Promise<ExtensionsState> {
  return (await readSettings()).extensions;
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  return updateSettings(async (settings) => {
    const extensions = { ...settings.extensions, [id]: enabled };
    await writeJsonFile(settingsJsonPath(), { ...settings, extensions });
  });
}

export type KeybindingOverrides = SettingsFile['keybindings'];

export async function getKeybindingOverrides(): Promise<KeybindingOverrides> {
  return (await readSettings()).keybindings;
}

export async function setKeybindingOverride(
  id: string,
  key: string | null,
): Promise<KeybindingOverrides> {
  return updateSettings(async (settings) => {
    const keybindings = { ...settings.keybindings };
    if (key === null) delete keybindings[id];
    else keybindings[id] = key;
    await writeJsonFile(settingsJsonPath(), { ...settings, keybindings });
    return keybindings;
  });
}
