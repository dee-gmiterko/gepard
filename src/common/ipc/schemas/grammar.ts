import { z } from 'zod';

export const GrammarLanguage = z.object({
  name: z.string().min(1),
  extensions: z.array(z.string().min(1)).min(1),
  filenames: z.array(z.string().min(1)).optional(),
});
export type GrammarLanguage = z.infer<typeof GrammarLanguage>;

export const GrammarModule = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  languages: z.array(GrammarLanguage).min(1),
  source: z.string(),
});
export type GrammarModule = z.infer<typeof GrammarModule>;
