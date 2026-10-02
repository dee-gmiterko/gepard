import { z } from 'zod';

export const LocaleData = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  messages: z.record(z.string(), z.string()),
});
export type LocaleData = z.infer<typeof LocaleData>;
