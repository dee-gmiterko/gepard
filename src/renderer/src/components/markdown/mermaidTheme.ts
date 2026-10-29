import type { Theme } from '../../theme/tokens';

export function mermaidThemeVariables(theme: Theme): Record<string, string | boolean> {
  const { colors, font } = theme;
  return {
    darkMode: theme.mode === 'dark',
    background: colors.bg,
    primaryColor: colors.bgElevated,
    primaryTextColor: colors.fg,
    textColor: colors.fg,
    primaryBorderColor: colors.borderStrong,
    lineColor: colors.fgMuted,
    secondaryColor: colors.bgSubtle,
    tertiaryColor: colors.bg,
    noteBkgColor: colors.commentBg,
    fontFamily: font.ui,
  };
}

export function mermaidFallbackTheme(theme: Theme): 'default' | 'dark' {
  return theme.mode === 'dark' ? 'dark' : 'default';
}
