import { z } from 'zod';

export const ContextMenuLabelKey = z.enum([
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
  'addToDictionary',
  'copyFilePath',
  'copyLineReference',
  'wrapLongLines',
  'fullFile',
]);
export type ContextMenuLabelKey = z.infer<typeof ContextMenuLabelKey>;

export const ContextMenuLabels = z.record(ContextMenuLabelKey, z.string());
export type ContextMenuLabels = z.infer<typeof ContextMenuLabels>;

export const ContextMenuLineTarget = z.object({
  path: z.string().min(1),
  line: z.int().positive(),
});
export type ContextMenuLineTarget = z.infer<typeof ContextMenuLineTarget>;

export const FileViewMenuRequest = z.object({
  x: z.number(),
  y: z.number(),
  wrapLongLines: z.boolean(),
  fullFileDiff: z.boolean(),
});
export type FileViewMenuRequest = z.infer<typeof FileViewMenuRequest>;

export const FileViewMenuPick = z.enum(['wrapLongLines', 'fullFile']);
export type FileViewMenuPick = z.infer<typeof FileViewMenuPick>;
