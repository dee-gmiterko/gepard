import { z } from 'zod';

export const LocaleMessages = z.record(z.string(), z.string());
export type LocaleMessages = z.infer<typeof LocaleMessages>;

export const LocaleData = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  messages: LocaleMessages,
});
export type LocaleData = z.infer<typeof LocaleData>;
