import { z } from 'zod';

const shadowSchema = z.object({
  popover: z.string().min(1),
  floating: z.string().min(1),
});

const colorsSchema = z.object({
  bg: z.string().min(1),
  bgSubtle: z.string().min(1),
  bgElevated: z.string().min(1),
  bgHover: z.string().min(1),
  bgSelected: z.string().min(1),
  fg: z.string().min(1),
  fgMuted: z.string().min(1),
  fgSubtle: z.string().min(1),
  border: z.string().min(1),
  borderStrong: z.string().min(1),
  accent: z.string().min(1),
  accentFg: z.string().min(1),
  danger: z.string().min(1),
  success: z.string().min(1),
  warning: z.string().min(1),
  diffAddBg: z.string().min(1),
  diffAddFg: z.string().min(1),
  diffDelBg: z.string().min(1),
  diffDelFg: z.string().min(1),
  diffHunk: z.string().min(1),
  commentBg: z.string().min(1),
  overlay: z.string().min(1),
});

const syntaxSchema = z.object({
  keyword: z.string().min(1),
  string: z.string().min(1),
  number: z.string().min(1),
  comment: z.string().min(1),
  type: z.string().min(1),
  function: z.string().min(1),
  property: z.string().min(1),
  constant: z.string().min(1),
  tag: z.string().min(1),
  invalid: z.string().min(1),
});

export const ExtensionThemeMode = z.enum(['light', 'dark']);
export type ExtensionThemeMode = z.infer<typeof ExtensionThemeMode>;

export const themeExtensionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: ExtensionThemeMode,
  shadow: shadowSchema,
  colors: colorsSchema,
  syntax: syntaxSchema,
});
export type ThemeExtension = z.infer<typeof themeExtensionSchema>;
