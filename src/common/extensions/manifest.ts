import { z } from 'zod';
import { GrammarLanguage } from '../ipc/schemas/grammar';

const functionSchema = z.custom<(...args: never[]) => unknown>((v) => typeof v === 'function');

export const packageManifestSchema = z.looseObject({
  main: z.string().optional(),
  gepard: z.looseObject({ type: z.string().optional() }).optional(),
});
export type PackageManifest = z.infer<typeof packageManifestSchema>;

export const extensionModuleSchema = z.looseObject({
  default: z.unknown().optional(),
  extension: z.unknown().optional(),
});
export type ExtensionModule = z.infer<typeof extensionModuleSchema>;

export const languageExtensionSchema = z.looseObject({
  id: z.string().min(1),
  displayName: z.string(),
  languages: z.array(GrammarLanguage).min(1),
  open: functionSchema,
});

export const grammarExtensionSchema = z.looseObject({
  id: z.string().min(1),
  displayName: z.string().min(1),
  languages: z.array(GrammarLanguage).min(1),
  support: functionSchema,
});
