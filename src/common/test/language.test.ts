import { describe, expect, it } from 'vitest';
import { languageIdOf } from '@gepard/common';

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
