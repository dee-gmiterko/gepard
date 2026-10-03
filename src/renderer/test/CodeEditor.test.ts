import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import type { GrammarExtension } from '@gepard/common';
import {
  allLanguageDescriptions,
  grammarLanguageDescriptions,
  hoveredSymbol,
} from '../src/components/CodeEditor';

const demoModule: GrammarExtension = {
  id: 'demo',
  displayName: 'Demo',
  languages: [
    { name: 'Demo', extensions: ['demo'], filenames: ['Demofile', 'project.demo'] },
    { name: 'DemoResource', extensions: ['dres'] },
  ],
  support(api, language) {
    const { StreamLanguage: Stream } = api;
    const lang = Stream.define({
      token(stream) {
        stream.skipToEnd();
        return language === 'Demo' ? 'keyword' : 'string';
      },
    });
    return language === 'Demo' ? lang : new LanguageSupport(lang);
  },
};

const grammars = [{ id: 'demo', displayName: 'Demo', languages: demoModule.languages, source: '' }];
const load = (): Promise<GrammarExtension> => Promise.resolve(demoModule);

describe('grammar language descriptions', () => {
  it('matches by extension and by exact filename', () => {
    const descriptions = grammarLanguageDescriptions(grammars, load);
    expect(LanguageDescription.matchFilename(descriptions, 'a/b.demo')?.name).toBe('Demo');
    expect(LanguageDescription.matchFilename(descriptions, 'x/Demofile')?.name).toBe('Demo');
    expect(LanguageDescription.matchFilename(descriptions, 'x/project.demo')?.name).toBe('Demo');
    expect(LanguageDescription.matchFilename(descriptions, 'a/b.dres')?.name).toBe('DemoResource');
    expect(LanguageDescription.matchFilename(descriptions, 'a/b.txt')).toBeNull();
  });

  it('loads a language or a language support from the module', async () => {
    const descriptions = grammarLanguageDescriptions(grammars, load);
    const bare = await descriptions[0].load();
    const wrapped = await descriptions[1].load();
    expect(bare).toBeInstanceOf(LanguageSupport);
    expect(bare.language).toBeInstanceOf(StreamLanguage);
    expect(wrapped).toBeInstanceOf(LanguageSupport);
  });

  it('puts extension languages ahead of the bundled ones without losing them', () => {
    const descriptions = allLanguageDescriptions(grammars, load);
    expect(descriptions[0].name).toBe('Demo');
    expect(LanguageDescription.matchFilename(descriptions, 'a.ts')?.name).toBe('TypeScript');
  });
});

const doc = 'const total = count + 42;\nreturn total;';
const state = EditorState.create({ doc });

describe('hoveredSymbol', () => {
  it('returns the identifier under the pointer with its 1-based line and column', () => {
    expect(hoveredSymbol(state, doc.indexOf('count') + 2, 1)).toEqual({
      name: 'count',
      from: 14,
      to: 19,
      line: 1,
      col: 15,
    });
    expect(hoveredSymbol(state, doc.indexOf('return') + 1, 1)?.line).toBe(2);
  });

  it('returns nothing for whitespace, punctuation and numbers', () => {
    expect(hoveredSymbol(state, doc.indexOf(' = ') + 1, 1)).toBeNull();
    expect(hoveredSymbol(state, doc.indexOf('+'), 1)).toBeNull();
    expect(hoveredSymbol(state, doc.indexOf('42'), 1)).toBeNull();
  });

  it('respects which side of the position the pointer is on at a word boundary', () => {
    const from = doc.indexOf('count');
    const to = from + 'count'.length;
    expect(hoveredSymbol(state, from, -1)).toBeNull();
    expect(hoveredSymbol(state, from, 1)?.name).toBe('count');
    expect(hoveredSymbol(state, to, 1)).toBeNull();
    expect(hoveredSymbol(state, to, -1)?.name).toBe('count');
  });
});
