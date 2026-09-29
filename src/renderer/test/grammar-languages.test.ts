import { describe, expect, it } from 'vitest';
import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import type { GrammarExtension } from '@gepard/common/extensions/grammar';
import {
  allLanguageDescriptions,
  grammarLanguageDescriptions,
  type GrammarApi,
} from '../src/components/CodeEditor/languages';

const demoModule: GrammarExtension = {
  id: 'demo',
  displayName: 'Demo',
  languages: [
    { name: 'Demo', extensions: ['demo'], filenames: ['Demofile', 'project.demo'] },
    { name: 'DemoResource', extensions: ['dres'] },
  ],
  support(api, language) {
    const { StreamLanguage: Stream } = api as GrammarApi;
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
const load = async (): Promise<GrammarExtension> => demoModule;

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
