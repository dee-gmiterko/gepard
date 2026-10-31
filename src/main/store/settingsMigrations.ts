import { z } from 'zod';

// Files written before versioning existed have no `version` field.
const SettingsV1 = z.object({
  theme: z.object({ templateId: z.string().nullable() }),
  locale: z.object({ localeId: z.string().nullable() }).default({ localeId: null }),
  extensions: z.record(z.string(), z.boolean()),
  keybindings: z.record(z.string(), z.string()).default({}),
  hiddenFiles: z.array(z.string()).default([]),
});

const SettingsV2 = SettingsV1.omit({ keybindings: true }).extend({
  version: z.literal(2),
  keybindings: z.record(z.string(), z.array(z.string())).default({}),
});

export const CURRENT_SETTINGS_VERSION = 2 as const;

function v1ToV2(v1: z.output<typeof SettingsV1>): z.output<typeof SettingsV2> {
  return {
    ...v1,
    version: CURRENT_SETTINGS_VERSION,
    keybindings: Object.fromEntries(Object.entries(v1.keybindings).map(([id, key]) => [id, [key]])),
  };
}

// Each older version is parsed by its own schema and chained forward to the current one.
export const SettingsFile = z.union([SettingsV2, SettingsV1.transform(v1ToV2)]);
export type SettingsFile = z.output<typeof SettingsFile>;
