import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  errorMessage,
  isGrammarExtension,
  isLanguageExtension,
  isLocaleExtension,
  isThemeExtension,
  type PackageManifest,
  type ExtensionInfo,
  type GrammarModule,
  type GrammarExtension,
  type ThemeExtension,
  type LocaleExtension,
  type LanguageExtension,
  AppError,
} from '@gepard/common';
import { type ExtensionKindDir } from '../paths';
import * as settingsStore from '../store/settings';
import { KindRegistry, type KindSpec } from '../helpers/kindRegistry';
import { readManifest } from './scanner';

const LSP_SPEC: KindSpec<LanguageExtension> = {
  kind: 'lsp',
  dirName: 'lsp',
  isValid: isLanguageExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

const GRAMMAR_SPEC: KindSpec<GrammarExtension> = {
  kind: 'grammar',
  dirName: 'grammars',
  isValid: isGrammarExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

const THEME_SPEC: KindSpec<ThemeExtension> = {
  kind: 'theme',
  dirName: 'themes',
  isValid: isThemeExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.name,
};

const LOCALE_SPEC: KindSpec<LocaleExtension> = {
  kind: 'locale',
  dirName: 'locales',
  isValid: isLocaleExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

export class ExtensionRegistry {
  private readonly lsp: KindRegistry<LanguageExtension>;
  private readonly grammar: KindRegistry<GrammarExtension>;
  private readonly theme: KindRegistry<ThemeExtension>;
  private readonly locale: KindRegistry<LocaleExtension>;

  constructor(overrideUserRootDir?: string, overrideBuiltinRootDir?: string) {
    const override = (root: string | undefined, dirName: ExtensionKindDir): string | undefined =>
      root ? path.join(root, dirName) : undefined;
    const registryFor = <T>(spec: KindSpec<T>): KindRegistry<T> =>
      new KindRegistry(
        spec,
        override(overrideUserRootDir, spec.dirName),
        override(overrideBuiltinRootDir, spec.dirName),
      );
    this.lsp = registryFor(LSP_SPEC);
    this.grammar = registryFor(GRAMMAR_SPEC);
    this.theme = registryFor(THEME_SPEC);
    this.locale = registryFor(LOCALE_SPEC);
  }

  async list(): Promise<ExtensionInfo[]> {
    const [lsp, grammar, theme, locale] = await Promise.all([
      this.lsp.list(),
      this.grammar.list(),
      this.theme.list(),
      this.locale.list(),
    ]);
    return [...lsp, ...grammar, ...theme, ...locale];
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionInfo[]> {
    await settingsStore.setEnabled(id, enabled);
    return this.list();
  }

  async install(srcDir: string): Promise<ExtensionInfo[]> {
    const name = path.basename(srcDir);
    let manifest: PackageManifest;
    try {
      manifest = await readManifest(srcDir);
    } catch (e) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}" has no valid package.json (${errorMessage(e)})`,
      );
    }
    const type = manifest.gepard?.type;
    if (type === LSP_SPEC.kind) {
      await this.lsp.install(srcDir);
    } else if (type === GRAMMAR_SPEC.kind) {
      await this.grammar.install(srcDir);
    } else if (type === THEME_SPEC.kind) {
      await this.theme.install(srcDir);
    } else if (type === LOCALE_SPEC.kind) {
      await this.locale.install(srcDir);
    } else {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}"'s package.json must set "gepard": { "type": "lsp" | "grammar" | "theme" | "locale" } (got ${JSON.stringify(type ?? null)})`,
      );
    }
    return this.list();
  }

  async enabledLanguageExtensions(): Promise<LanguageExtension[]> {
    return this.lsp.enabledExtensions();
  }

  async enabledGrammars(): Promise<GrammarModule[]> {
    const packages = await this.grammar.enabledPackages();
    return Promise.all(
      packages.map(async ({ extension, dir }) => {
        const manifest = await readManifest(dir);
        const source = await readFile(path.join(dir, manifest.main ?? 'index.js'), 'utf8');
        return {
          id: extension.id,
          displayName: extension.displayName,
          languages: extension.languages,
          source,
        };
      }),
    );
  }

  async enabledThemeTemplates(): Promise<ThemeExtension[]> {
    return this.theme.enabledExtensions();
  }

  async enabledLocales(): Promise<LocaleExtension[]> {
    return this.locale.enabledExtensions();
  }
}

export const extensionRegistry = new ExtensionRegistry();
