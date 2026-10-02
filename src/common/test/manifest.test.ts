import { describe, expect, it } from 'vitest';
import { isGrammarExtension, isLanguageExtension, packageManifestSchema } from '@gepard/common';

describe('packageManifestSchema', () => {
  it('rejects non-objects', () => {
    expect(packageManifestSchema.safeParse(null).success).toBe(false);
    expect(packageManifestSchema.safeParse('x').success).toBe(false);
  });
});

describe('extension predicates', () => {
  const fn = (): void => {};

  it('accepts a complete language extension and rejects an incomplete one', () => {
    const ext = {
      id: 'a',
      displayName: 'A',
      languages: [{ name: 'a', extensions: ['a'] }],
      open: fn,
    };
    expect(isLanguageExtension(ext)).toBe(true);
    expect(isLanguageExtension({ ...ext, open: undefined })).toBe(false);
    expect(isLanguageExtension({ ...ext, id: '' })).toBe(false);
  });

  it('accepts a complete grammar extension and rejects missing languages', () => {
    const ext = {
      id: 'g',
      displayName: 'G',
      languages: [{ name: 'g', extensions: ['.g'] }],
      support: fn,
    };
    expect(isGrammarExtension(ext)).toBe(true);
    expect(isGrammarExtension({ ...ext, languages: [] })).toBe(false);
  });
});
