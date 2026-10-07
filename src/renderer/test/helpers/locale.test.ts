import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../../src/helpers/locale';

describe('resolveLocale', () => {
  it('picks an exact match', () => {
    expect(resolveLocale(['en', 'cs'], ['cs'], 'en')).toBe('cs');
  });

  it('is case-insensitive', () => {
    expect(resolveLocale(['en', 'cs'], ['CS'], 'en')).toBe('cs');
  });

  it('falls back to the base language when the region is not available', () => {
    expect(resolveLocale(['en', 'cs'], ['cs-CZ'], 'en')).toBe('cs');
  });

  it('tries preferred languages in order', () => {
    expect(resolveLocale(['en', 'fr'], ['de', 'fr-FR'], 'en')).toBe('fr');
  });

  it('falls back to the default locale when nothing matches', () => {
    expect(resolveLocale(['en', 'cs'], ['de-DE'], 'en')).toBe('en');
  });

  it('falls back to the first available locale when the default is missing', () => {
    expect(resolveLocale(['cs', 'fr'], ['de-DE'], 'en')).toBe('cs');
  });
});
