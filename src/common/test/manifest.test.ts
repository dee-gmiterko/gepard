import { describe, expect, it } from 'vitest';
import {
  extensionModuleSchema,
  isGrammarExtension,
  isLanguageExtension,
  packageManifestSchema,
} from '@gepard/common';

describe('packageManifestSchema', () => {
  it('reads main and gepard.type and keeps other keys', () => {
    const manifest = packageManifestSchema.parse({
      name: 'x',
      main: 'dist/index.js',
      gepard: { type: 'lsp' },
    });
    expect(manifest.main).toBe('dist/index.js');
    expect(manifest.gepard?.type).toBe('lsp');
  });

  it('rejects non-objects', () => {
    expect(packageManifestSchema.safeParse(null).success).toBe(false);
    expect(packageManifestSchema.safeParse('x').success).toBe(false);
  });
});

describe('extensionModuleSchema', () => {
  it('exposes default and extension exports', () => {
    const exports = extensionModuleSchema.parse({ default: 1, extension: 2, other: 3 });
    expect([exports.default, exports.extension]).toEqual([1, 2]);
  });
});

describe('extension predicates', () => {
  const fn = (): void => {};

  it('accepts a complete language extension and rejects an incomplete one', () => {
    const ext = { id: 'a', displayName: 'A', matches: fn, languageId: fn, open: fn };
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
