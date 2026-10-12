import { describe, expect, it } from 'vitest';
import {
  analyzeSource,
  collectPairs,
  collectRendererPairs,
  contrastRatio,
  evaluateTheme,
  loadBundledThemes,
  requiredRatio,
  WCAG,
} from '../theme-contrast';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#0969da', '#ffffff')).toBeCloseTo(5.19, 2);
  });

  it('composites translucent colours over their background', () => {
    const halfBlack = contrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff');
    expect(halfBlack).toBeGreaterThan(3);
    expect(halfBlack).toBeLessThan(21);
    expect(contrastRatio('#0003', '#fff')).toBeCloseTo(
      contrastRatio('rgba(0,0,0,0.2)', '#ffffff'),
      5,
    );
  });
});

describe('analyzeSource', () => {
  it('reads styled-components rules and nested selectors', () => {
    const source = `
      const Row = styled.div\`
        color: \${({ theme }) => theme.colors.fg};
        border-bottom: 1px solid \${({ theme }) => theme.colors.border};

        &:hover {
          background: \${({ theme }) => theme.colors.bgHover};
        }
      \`;
    `;
    const { blocks, backgrounds } = analyzeSource(source);
    expect([...backgrounds]).toEqual(['colors.bgHover']);
    const hover = blocks.find((block) => block.bg.has('colors.bgHover'));
    expect(hover && [...hover.fg]).toEqual(['colors.fg']);
    expect(hover && [...hover.border]).toEqual(['colors.border']);
  });

  it('reads CodeMirror theme objects', () => {
    const source = `
      const c = theme.colors;
      const s = theme.syntax;
      EditorView.theme({
        '.cm-line-add': { backgroundColor: c.diffAddBg, color: c.diffAddFg },
      });
      HighlightStyle.define([{ tag: tags.keyword, color: s.keyword }]);
    `;
    const { blocks } = analyzeSource(source);
    expect(blocks).toContainEqual(
      expect.objectContaining({
        fg: new Set(['colors.diffAddFg']),
        bg: new Set(['colors.diffAddBg']),
      }),
    );
    expect(blocks.some((block) => block.fg.has('syntax.keyword'))).toBe(true);
  });
});

describe('collectPairs', () => {
  it('pairs declared colours within a rule and its nested rules', () => {
    const source = `
      const Row = styled.div\`
        color: \${({ theme }) => theme.colors.fgMuted};
        &:hover { background: \${({ theme }) => theme.colors.bgHover}; }
      \`;
    `;
    const pairs = collectPairs([{ name: 'row.tsx', source }]);
    expect(pairs).toContainEqual(
      expect.objectContaining({
        kind: 'text',
        fg: 'colors.fgMuted',
        bg: 'colors.bgHover',
        origin: 'declared',
      }),
    );
  });

  it('keeps sibling css branches and sibling components apart', () => {
    const source = `
      const Button = styled.button\`
        \${({ theme, $primary }) =>
          $primary
            ? css\`
                background: \${theme.colors.accent};
                color: \${theme.colors.accentFg};
              \`
            : css\`
                color: \${theme.colors.fg};
              \`}
      \`;
      const Fill = styled.div\`
        background: \${({ theme }) => theme.colors.success};
      \`;
    `;
    const pairs = collectPairs([{ name: 'button.tsx', source }]);
    const keys = pairs.map((pair) => `${pair.fg} on ${pair.bg}`);
    expect(keys).toContain('colors.accentFg on colors.accent');
    expect(keys).not.toContain('colors.fg on colors.accent');
    expect(keys).not.toContain('colors.fg on colors.success');
    expect(keys).not.toContain('colors.accentFg on colors.success');
  });

  it('checks unbacked text against the base surfaces and the file surfaces', () => {
    const source = `
      const Label = styled.span\`
        color: \${({ theme }) => theme.colors.fgSubtle};
      \`;
      const Panel = styled.div\`
        background: \${({ theme }) => theme.colors.bgSelected};
      \`;
    `;
    const pairs = collectPairs([{ name: 'label.tsx', source }]);
    const inherited = pairs.filter((pair) => pair.origin === 'inherited').map((pair) => pair.bg);
    expect(inherited.sort()).toEqual([
      'colors.bg',
      'colors.bgElevated',
      'colors.bgSelected',
      'colors.bgSubtle',
    ]);
  });
});

describe('requiredRatio', () => {
  it('requires AAA for body text, AA for other text and 3:1 for borders', () => {
    const pair = { origin: 'declared' as const, sources: [] };
    expect(requiredRatio({ ...pair, kind: 'text', fg: 'colors.fg', bg: 'colors.bg' })).toBe(
      WCAG.aaaText,
    );
    expect(requiredRatio({ ...pair, kind: 'text', fg: 'colors.fgMuted', bg: 'colors.bg' })).toBe(
      WCAG.aaaText,
    );
    expect(requiredRatio({ ...pair, kind: 'text', fg: 'syntax.keyword', bg: 'colors.bg' })).toBe(
      WCAG.aaText,
    );
    expect(requiredRatio({ ...pair, kind: 'border', fg: 'colors.border', bg: 'colors.bg' })).toBe(
      WCAG.aaUi,
    );
  });
});

describe('bundled high contrast themes', () => {
  it('meet WCAG contrast for every colour pair the renderer uses', async () => {
    const pairs = collectRendererPairs();
    expect(pairs.length).toBeGreaterThan(100);
    expect(pairs).toContainEqual(
      expect.objectContaining({ kind: 'text', fg: 'colors.fg', bg: 'colors.bg' }),
    );
    expect(pairs).toContainEqual(
      expect.objectContaining({ kind: 'text', fg: 'colors.diffAddFg', bg: 'colors.diffAddBg' }),
    );
    expect(pairs).toContainEqual(
      expect.objectContaining({ kind: 'border', fg: 'colors.border', bg: 'colors.bg' }),
    );

    const themes = (await loadBundledThemes()).filter((theme) => theme.contrast === 'high');
    expect(themes.map((theme) => theme.id).sort()).toEqual([
      'dark-high-contrast',
      'light-high-contrast',
    ]);
    for (const theme of themes) {
      const failing = evaluateTheme(theme, pairs)
        .filter((result) => !result.passes)
        .map(({ fg, bg, ratio, required }) => `${fg} on ${bg} ${ratio.toFixed(2)} < ${required}`);
      expect(failing).toEqual([]);
    }
  });
});
