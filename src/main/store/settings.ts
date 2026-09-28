import { z } from 'zod';
import { settingsJsonPath } from '../paths';
import { readJsonFile, writeJsonFile } from '../helpers/fs/jsonFile';

const SettingsFile = z.object({
  theme: z.object({ templateId: z.string().nullable() }),
  extensions: z.record(z.string(), z.boolean()),
});
type SettingsFile = z.infer<typeof SettingsFile>;

const EMPTY_SETTINGS: SettingsFile = { theme: { templateId: null }, extensions: {} };

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

export type ExtensionsState = SettingsFile['extensions'];

export async function getEnabledMap(): Promise<ExtensionsState> {
  return (await readSettings()).extensions;
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  const settings = await readSettings();
  const extensions = { ...settings.extensions, [id]: enabled };
  await writeJsonFile(settingsJsonPath(), { ...settings, extensions });
}
