import { describe, expect, it } from 'vitest';
import { FALLBACK_TEMPLATE, resolveTemplate } from '../../src/helpers/theme';
import type { ThemeTemplateData } from '@gepard/common';

const tpl = (id: string, mode: 'light' | 'dark'): ThemeTemplateData => ({
  ...FALLBACK_TEMPLATE,
  id,
  mode,
});
const light = tpl('l', 'light');
const dark = tpl('d', 'dark');

describe('resolveTemplate', () => {
  it('uses the selected template when it exists', () => {
    expect(resolveTemplate('d', false, [light, dark])).toBe(dark);
  });

  it('falls back to the first template matching the system mode', () => {
    expect(resolveTemplate('missing', true, [light, dark])).toBe(dark);
    expect(resolveTemplate(null, false, [dark, light])).toBe(light);
  });

  it('uses the first template when no mode matches and a built-in fallback when empty', () => {
    expect(resolveTemplate(null, true, [light])).toBe(light);
    expect(resolveTemplate(null, true, []).id).toBe('__fallback__');
  });
});
