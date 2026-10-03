import { describe, expect, it } from 'vitest';
import type { LocaleCatalog } from '../refresh-locales';
import { mergeLocaleCatalog, refreshCatalogs } from '../refresh-locales';

describe('mergeLocaleCatalog', () => {
  it('mirrors the extracted default text for the source locale', () => {
    const existing = { greeting: 'stale text' };
    const extracted = {
      greeting: { defaultMessage: 'Hello' },
      farewell: { defaultMessage: 'Bye' },
    };
    const { catalog, staleIds } = mergeLocaleCatalog(existing, extracted, {}, { isSource: true });
    expect(catalog).toEqual({ farewell: 'Bye', greeting: 'Hello' });
    expect(staleIds).toEqual([]);
  });

  it('adds missing keys to other locales using the default text as a placeholder', () => {
    const existing = { greeting: 'Ahoj' };
    const extracted = {
      greeting: { defaultMessage: 'Hello' },
      farewell: { defaultMessage: 'Bye' },
    };
    const oldSource = { greeting: 'Hello' };
    const { catalog, staleIds } = mergeLocaleCatalog(existing, extracted, oldSource, {
      isSource: false,
    });
    expect(catalog).toEqual({ farewell: 'Bye', greeting: 'Ahoj' });
    expect(staleIds).toEqual([]);
  });

  it('drops keys that no longer exist in the extraction', () => {
    const existing = { removed: 'Old', greeting: 'Ahoj' };
    const extracted = { greeting: { defaultMessage: 'Hello' } };
    const oldSource = { removed: 'Removed', greeting: 'Hello' };
    const { catalog } = mergeLocaleCatalog(existing, extracted, oldSource, { isSource: false });
    expect(catalog).toEqual({ greeting: 'Ahoj' });
  });

  it('keeps a translation untouched but flags it stale when the source text changed', () => {
    const existing = { greeting: 'Ahoj' };
    const extracted = { greeting: { defaultMessage: 'Hi there' } };
    const oldSource = { greeting: 'Hello' };
    const { catalog, staleIds } = mergeLocaleCatalog(existing, extracted, oldSource, {
      isSource: false,
    });
    expect(catalog).toEqual({ greeting: 'Ahoj' });
    expect(staleIds).toEqual(['greeting']);
  });

  it('does not flag an untranslated placeholder as stale when the source text changes', () => {
    const existing = { greeting: 'Hello' };
    const extracted = { greeting: { defaultMessage: 'Hi there' } };
    const oldSource = { greeting: 'Hello' };
    const { catalog, staleIds } = mergeLocaleCatalog(existing, extracted, oldSource, {
      isSource: false,
    });
    expect(catalog).toEqual({ greeting: 'Hello' });
    expect(staleIds).toEqual([]);
  });
});

describe('refreshCatalogs', () => {
  it('reads each locale file and merges it independently', () => {
    const extracted = { greeting: { defaultMessage: 'Hello' } };
    const catalogsByFile = new Map<string, LocaleCatalog>([
      ['/locales/en.json', {}],
      ['/locales/cs.json', { greeting: 'Ahoj' }],
    ]);
    const result = refreshCatalogs(
      extracted,
      ['/locales/en.json', '/locales/cs.json'],
      (file) => catalogsByFile.get(file) ?? {},
      (file) => file.replace('/locales/', '').replace('.json', ''),
    );
    expect(result).toEqual([
      { file: '/locales/en.json', locale: 'en', catalog: { greeting: 'Hello' }, staleIds: [] },
      { file: '/locales/cs.json', locale: 'cs', catalog: { greeting: 'Ahoj' }, staleIds: [] },
    ]);
  });

  it('compares non-source locales against the on-disk source catalog', () => {
    const extracted = { greeting: { defaultMessage: 'Hi there' } };
    const catalogsByFile = new Map<string, LocaleCatalog>([
      ['/locales/en.json', { greeting: 'Hello' }],
      ['/locales/cs.json', { greeting: 'Ahoj' }],
    ]);
    const result = refreshCatalogs(
      extracted,
      ['/locales/en.json', '/locales/cs.json'],
      (file) => catalogsByFile.get(file) ?? {},
      (file) => file.replace('/locales/', '').replace('.json', ''),
    );
    const cs = result.find((entry) => entry.locale === 'cs');
    expect(cs?.staleIds).toEqual(['greeting']);
    expect(cs?.catalog).toEqual({ greeting: 'Ahoj' });
  });
});
