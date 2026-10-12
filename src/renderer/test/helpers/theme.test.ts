import { describe, expect, it } from 'vitest';
import { FALLBACK_TEMPLATE, resolveTemplate } from '../../src/helpers/theme';
import type { ThemeTemplateData } from '@gepard/common';

const tpl = (
  id: string,
  mode: 'light' | 'dark',
  contrast?: 'normal' | 'high',
): ThemeTemplateData => ({
  ...FALLBACK_TEMPLATE,
  id,
  mode,
  ...(contrast ? { contrast } : {}),
});
const light = tpl('l', 'light');
const dark = tpl('d', 'dark');
const lightHc = tpl('l-hc', 'light', 'high');
const darkHc = tpl('d-hc', 'dark', 'high');
const all = [darkHc, lightHc, dark, light];

const normal = { dark: false, highContrast: false };
const darkNormal = { dark: true, highContrast: false };
const lightHigh = { dark: false, highContrast: true };
const darkHigh = { dark: true, highContrast: true };

describe('resolveTemplate', () => {
  it('uses the selected template when it exists', () => {
    expect(resolveTemplate('d', normal, [light, dark])).toBe(dark);
    expect(resolveTemplate('l', darkHigh, all)).toBe(light);
  });

  it('follows the system colour scheme with the normal contrast variant', () => {
    expect(resolveTemplate(null, normal, all)).toBe(light);
    expect(resolveTemplate(null, darkNormal, all)).toBe(dark);
    expect(resolveTemplate('missing', darkNormal, all)).toBe(dark);
  });

  it('follows the system high contrast preference per colour scheme', () => {
    expect(resolveTemplate(null, lightHigh, all)).toBe(lightHc);
    expect(resolveTemplate(null, darkHigh, all)).toBe(darkHc);
  });

  it('treats a template without a contrast as normal', () => {
    expect(resolveTemplate(null, normal, [lightHc, tpl('l2', 'light')]).id).toBe('l2');
  });

  it('falls back to any template of the system colour scheme without a contrast match', () => {
    expect(resolveTemplate(null, lightHigh, [dark, light])).toBe(light);
    expect(resolveTemplate(null, normal, [darkHc, lightHc])).toBe(lightHc);
  });

  it('uses the first template when no mode matches and a built-in fallback when empty', () => {
    expect(resolveTemplate(null, darkNormal, [light])).toBe(light);
    expect(resolveTemplate(null, darkHigh, []).id).toBe('__fallback__');
  });
});
