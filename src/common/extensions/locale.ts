import { z } from 'zod';

export const localeExtensionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  messages: z.record(z.string(), z.string()),
});
export type LocaleExtension = z.infer<typeof localeExtensionSchema>;
