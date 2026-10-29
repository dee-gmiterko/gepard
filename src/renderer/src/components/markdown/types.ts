import { z } from 'zod';

export const MarkdownViewType = z.enum(['file', 'diff']);
export type MarkdownViewType = z.infer<typeof MarkdownViewType>;
