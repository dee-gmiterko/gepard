import { z } from 'zod';
import { settingsJsonPath } from '../paths';
import { readJsonFile, writeJsonFile } from '../helpers/fs/jsonFile';

const SettingsFile = z.object({
  theme: z.object({ templateId: z.string().nullable() }),
  // `.default(...)` (rather than a required field) keeps `settings.json` files
  // written before locale selection existed loading fine - `readJsonFile`
  // treats a schema mismatch on an existing file as corruption, it does not
  // fall back to defaults itself.
  locale: z.object({ localeId: z.string().nullable() }).default({ localeId: null }),
  extensions: z.record(z.string(), z.boolean()),
});
type SettingsFile = z.infer<typeof SettingsFile>;

const EMPTY_SETTINGS: SettingsFile = {
  theme: { templateId: null },
  locale: { localeId: null },
  extensions: {},
};

async function readSettings(): Promise<SettingsFile> {
  return readJsonFile(settingsJsonPath(), SettingsFile, () => EMPTY_SETTINGS);
}

export async function getTemplateId(): Promise<string | null> {
  const settings = await readSettings();
  return settings.theme.templateId;
}

export async function setTemplateId(templateId: string | null): Promise<string | null> {
  const settings = await readSettings();
  await writeJsonFile(settingsJsonPath(), { ...settings, theme: { templateId } });
  return templateId;
}

export async function getLocaleId(): Promise<string | null> {
  const settings = await readSettings();
  return settings.locale.localeId;
}

export async function setLocaleId(localeId: string | null): Promise<string | null> {
  const settings = await readSettings();
  await writeJsonFile(settingsJsonPath(), { ...settings, locale: { localeId } });
  return localeId;
}

export type ExtensionsState = SettingsFile['extensions'];

export async function getEnabledMap(): Promise<ExtensionsState> {
  return (await readSettings()).extensions;
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  const settings = await readSettings();
  const extensions = { ...settings.extensions, [id]: enabled };
  await writeJsonFile(settingsJsonPath(), { ...settings, extensions });
}
