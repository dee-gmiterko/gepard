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
  'randomizeOrder',
  'incrementalDiff',
  'showCurrent',
  'markdownPreview',
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
  randomizeOrder: z.boolean(),
  incrementalDiff: z.boolean(),
  showCurrent: z.boolean(),
  markdownPreview: z.boolean(),
});
export type FileViewMenuRequest = z.infer<typeof FileViewMenuRequest>;

export const FileViewMenuPick = z.enum([
  'wrapLongLines',
  'fullFile',
  'randomizeOrder',
  'incrementalDiff',
  'showCurrent',
  'markdownPreview',
]);
export type FileViewMenuPick = z.infer<typeof FileViewMenuPick>;

export const FILE_VIEW_MENU_STATE = {
  wrapLongLines: 'wrapLongLines',
  fullFile: 'fullFileDiff',
  randomizeOrder: 'randomizeOrder',
  incrementalDiff: 'incrementalDiff',
  showCurrent: 'showCurrent',
  markdownPreview: 'markdownPreview',
} as const satisfies Record<FileViewMenuPick, keyof FileViewMenuRequest>;

export const TextMenuCommand = ContextMenuLabelKey.extract([
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
]);
export type TextMenuCommand = z.infer<typeof TextMenuCommand>;

export const TextMenuRequest = z.object({
  x: z.number(),
  y: z.number(),
  editable: z.boolean(),
  hasSelection: z.boolean(),
  target: ContextMenuLineTarget.nullable(),
});
export type TextMenuRequest = z.infer<typeof TextMenuRequest>;

export const ContextMenuRequest = z.discriminatedUnion('kind', [
  TextMenuRequest.extend({ kind: z.literal('text') }),
  FileViewMenuRequest.extend({ kind: z.literal('fileView') }),
]);
export type ContextMenuRequest = z.infer<typeof ContextMenuRequest>;
