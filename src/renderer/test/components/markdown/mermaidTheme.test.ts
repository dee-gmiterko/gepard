import { describe, expect, it } from 'vitest';
import {
  mermaidFallbackTheme,
  mermaidThemeVariables,
} from '../../../src/components/markdown/mermaidTheme';
import { buildTheme, type Theme } from '../../../src/theme/tokens';

function themeOf(mode: 'light' | 'dark'): Theme {
  const colors = new Proxy({}, { get: (_t, key) => `c-${String(key)}` });
  return { ...buildTheme({ mode, colors, syntax: {}, shadow: {} } as never), colors } as never;
}

describe('mermaidThemeVariables', () => {
  it('maps theme tokens to mermaid variables', () => {
    const vars = mermaidThemeVariables(themeOf('dark'));
    expect(vars).toMatchObject({
      darkMode: true,
      background: 'c-bg',
      primaryColor: 'c-bgElevated',
      primaryTextColor: 'c-fg',
      textColor: 'c-fg',
      primaryBorderColor: 'c-borderStrong',
      lineColor: 'c-fgMuted',
      secondaryColor: 'c-bgSubtle',
      tertiaryColor: 'c-bg',
      noteBkgColor: 'c-commentBg',
    });
    expect(mermaidThemeVariables(themeOf('light')).darkMode).toBe(false);
  });

  it('picks the built-in fallback theme by mode', () => {
    expect(mermaidFallbackTheme(themeOf('dark'))).toBe('dark');
    expect(mermaidFallbackTheme(themeOf('light'))).toBe('default');
  });
});
