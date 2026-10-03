import { describe, expect, it } from 'vitest';
import {
  isGrammarExtension,
  isLanguageExtension,
  isLocaleExtension,
  languageIdOf,
} from '@gepard/common';

const languages = [
  { name: 'typescript', extensions: ['ts', 'mts'] },
  { name: 'typescriptreact', extensions: ['tsx'] },
  { name: 'dockerfile', extensions: ['dockerfile'], filenames: ['Dockerfile'] },
];

describe('languageIdOf', () => {
  it('finds the language by file extension', () => {
    expect(languageIdOf(languages, 'src/a.ts')).toBe('typescript');
    expect(languageIdOf(languages, 'src/a.mts')).toBe('typescript');
    expect(languageIdOf(languages, 'src/a.tsx')).toBe('typescriptreact');
  });

  it('finds the language by exact file name', () => {
    expect(languageIdOf(languages, 'build/Dockerfile')).toBe('dockerfile');
  });

  it('is undefined for files no language claims', () => {
    expect(languageIdOf(languages, 'src/a.py')).toBeUndefined();
    expect(languageIdOf(languages, 'tsx')).toBeUndefined();
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

describe('isLocaleExtension', () => {
  it('rejects values that are not locale data', () => {
    expect(isLocaleExtension(null)).toBe(false);
    expect(isLocaleExtension({})).toBe(false);
    expect(isLocaleExtension('en')).toBe(false);
  });
});
