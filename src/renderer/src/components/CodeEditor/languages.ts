import {
  Language,
  LanguageDescription,
  LanguageSupport,
  LRLanguage,
  StreamLanguage,
} from '@codemirror/language';
import { languages as builtinLanguages } from '@codemirror/language-data';
import { styleTags, tags } from '@lezer/highlight';
import { LRParser } from '@lezer/lr';
import type { GrammarModule } from '@gepard/common/ipc/schemas/grammar';
import type { GrammarExtension } from '@gepard/common/extensions/grammar';

export const grammarApi = {
  StreamLanguage,
  LRLanguage,
  LanguageSupport,
  styleTags,
  tags,
  LRParser,
};
export type GrammarApi = typeof grammarApi;

export type GrammarModuleLoader = (source: string) => Promise<GrammarExtension>;

const moduleCache = new Map<string, Promise<GrammarExtension>>();

export function loadGrammarModule(source: string): Promise<GrammarExtension> {
  let loaded = moduleCache.get(source);
  if (!loaded) {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    loaded = import(/* @vite-ignore */ url)
      .then((mod: { default?: unknown }) => {
        const candidate = mod.default;
        if (!candidate || typeof candidate !== 'object' || !('support' in candidate)) {
          throw new Error('grammar module has no default export with support()');
        }
        return candidate as GrammarExtension;
      })
      .finally(() => URL.revokeObjectURL(url));
    moduleCache.set(source, loaded);
    loaded.catch(() => moduleCache.delete(source));
  }
  return loaded;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function grammarLanguageDescriptions(
  grammars: readonly GrammarModule[],
  load: GrammarModuleLoader = loadGrammarModule,
): LanguageDescription[] {
  return grammars.flatMap((grammar) =>
    grammar.languages.map((language) =>
      LanguageDescription.of({
        name: language.name,
        extensions: language.extensions,
        filename: language.filenames?.length
          ? new RegExp(`(^|/)(${language.filenames.map(escapeRegExp).join('|')})$`)
          : undefined,
        async load() {
          const mod = await load(grammar.source);
          const support = mod.support(grammarApi, language.name);
          if (support instanceof LanguageSupport) return support;
          if (support instanceof Language) return new LanguageSupport(support);
          throw new Error(`grammar "${grammar.id}" returned no language for "${language.name}"`);
        },
      }),
    ),
  );
}

export function allLanguageDescriptions(
  grammars: readonly GrammarModule[],
  load?: GrammarModuleLoader,
): LanguageDescription[] {
  return [...grammarLanguageDescriptions(grammars, load), ...builtinLanguages];
}
