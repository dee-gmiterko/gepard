import { z } from 'zod';

const ThemeShadow = z.object({
  popover: z.string().min(1),
  floating: z.string().min(1),
});

const ThemeColors = z.object({
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

const ThemeSyntax = z.object({
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

export const ThemeMode = z.enum(['light', 'dark']);
export type ThemeMode = z.infer<typeof ThemeMode>;

export const ThemeTemplateData = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: ThemeMode,
  shadow: ThemeShadow,
  colors: ThemeColors,
  syntax: ThemeSyntax,
});
export type ThemeTemplateData = z.infer<typeof ThemeTemplateData>;
