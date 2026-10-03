import { z } from 'zod';

export const ContextMenuLabels = z.object({
  undo: z.string(),
  redo: z.string(),
  cut: z.string(),
  copy: z.string(),
  paste: z.string(),
  selectAll: z.string(),
  addToDictionary: z.string(),
  copyFilePath: z.string(),
  copyLineReference: z.string(),
});
export type ContextMenuLabels = z.infer<typeof ContextMenuLabels>;

export const ContextMenuLineTarget = z.object({
  path: z.string().min(1),
  line: z.int().positive(),
});
export type ContextMenuLineTarget = z.infer<typeof ContextMenuLineTarget>;
