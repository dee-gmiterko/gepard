import { describe, expect, it } from 'vitest';
import { LanguageSupport, LRLanguage, StreamLanguage } from '@codemirror/language';
import { styleTags, tags } from '@lezer/highlight';
import { LRParser } from '@lezer/lr';
import extension from '../dist/index.js';

const api = { StreamLanguage, LRLanguage, LanguageSupport, styleTags, tags, LRParser };

describe('godot grammar extension (built)', () => {
  it('declares its languages and file types', () => {
    expect(extension.id).toBe('godot');
    expect(extension.languages.map((l) => l.name)).toEqual(['GDScript', 'GDResource', 'GDShader']);
    expect(extension.languages.flatMap((l) => l.extensions)).toEqual([
      'gd',
      'tscn',
      'tres',
      'godot',
      'import',
      'gdns',
      'gdnlib',
      'gdshader',
      'gdshaderinc',
    ]);
  });

  it('builds a language from the host api for every declared language', () => {
    for (const { name } of extension.languages) {
      const language = extension.support(api, name);
      expect(language).toBeInstanceOf(StreamLanguage);
    }
  });

  it('is a self-contained module', () => {
    expect(() => extension.support(api, 'Nope')).toThrow(/unknown Godot language/);
  });
});
