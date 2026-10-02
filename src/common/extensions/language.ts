import { z } from 'zod';

export const extensionLanguageSchema = z.object({
  name: z.string().min(1),
  extensions: z.array(z.string().min(1)).min(1),
  filenames: z.array(z.string().min(1)).optional(),
});
export type ExtensionLanguage = z.infer<typeof extensionLanguageSchema>;
