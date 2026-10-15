import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import {
  AppError,
  errorMessage,
  isErrnoException,
  isGrammarExtension,
  isLanguageExtension,
  isLocaleExtension,
  isThemeExtension,
  type ExtensionInfo,
  type GrammarExtension,
  type GrammarModule,
  type LanguageExtension,
  type LocaleExtension,
  type PackageManifest,
  type ThemeExtension,
} from '@gepard/common';
import { dedupeBroken } from '../helpers/extension';
import { KindRegistry, type KindSpec } from '../extensions/kindRegistry';
import { readManifest } from '../extensions/scanner';
import * as settingsStore from '../store/settings';

const LSP_SPEC: KindSpec<LanguageExtension> = {
  kind: 'lsp',
  isValid: isLanguageExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

const GRAMMAR_SPEC: KindSpec<GrammarExtension> = {
  kind: 'grammar',
  isValid: isGrammarExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

const THEME_SPEC: KindSpec<ThemeExtension> = {
  kind: 'theme',
  isValid: isThemeExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.name,
};

const LOCALE_SPEC: KindSpec<LocaleExtension> = {
  kind: 'locale',
  isValid: isLocaleExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

export interface InstallOptions {
  dirName?: string;
  replacePackage?: string;
}

export class ExtensionsService {
  private readonly lsp: KindRegistry<LanguageExtension>;
  private readonly grammar: KindRegistry<GrammarExtension>;
  private readonly theme: KindRegistry<ThemeExtension>;
  private readonly locale: KindRegistry<LocaleExtension>;

  constructor(
    readonly userDir: () => string,
    builtinDir: () => string,
  ) {
    this.lsp = new KindRegistry(LSP_SPEC, userDir, builtinDir);
    this.grammar = new KindRegistry(GRAMMAR_SPEC, userDir, builtinDir);
    this.theme = new KindRegistry(THEME_SPEC, userDir, builtinDir);
    this.locale = new KindRegistry(LOCALE_SPEC, userDir, builtinDir);
  }

  async list(): Promise<ExtensionInfo[]> {
    const lists = await Promise.all([
      this.lsp.list(),
      this.grammar.list(),
      this.theme.list(),
      this.locale.list(),
    ]);
    return dedupeBroken(lists.flat());
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionInfo[]> {
    await settingsStore.setEnabled(id, enabled);
    return this.list();
  }

  async install(srcDir: string, options: InstallOptions = {}): Promise<ExtensionInfo[]> {
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
    if (![LSP_SPEC, GRAMMAR_SPEC, THEME_SPEC, LOCALE_SPEC].some((spec) => spec.kind === type)) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}"'s package.json must set "gepard": { "type": "lsp" | "grammar" | "theme" | "locale" } (got ${JSON.stringify(type ?? null)})`,
      );
    }
    await this.copyPackage(srcDir, options);
    return this.list();
  }

  private async copyPackage(srcDir: string, options: InstallOptions): Promise<void> {
    const userDir = this.userDir();
    const name = options.dirName ?? path.basename(srcDir);
    await mkdir(userDir, { recursive: true });
    if (options.replacePackage !== undefined) {
      await this.removePackage(userDir, options.replacePackage);
      await rm(path.join(userDir, name), { recursive: true, force: true });
      this.forget(path.join(userDir, name));
    }
    try {
      await cp(srcDir, path.join(userDir, name), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ERR_FS_CP_EEXIST') {
        throw new AppError(
          'EXTENSION_ALREADY_EXISTS',
          `An extension named "${name}" already exists.`,
        );
      }
      throw e;
    }
  }

  private async removePackage(userDir: string, packageName: string): Promise<void> {
    let names: string[];
    try {
      names = (await readdir(userDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ENOENT') return;
      throw e;
    }
    for (const name of names) {
      const dir = path.join(userDir, name);
      let installedName: string | undefined;
      try {
        installedName = (await readManifest(dir)).name;
      } catch {
        continue;
      }
      if (installedName !== packageName) continue;
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (e) {
        throw new AppError(
          'EXTENSION_IN_USE',
          `"${name}" could not be removed (${errorMessage(e)}); restart Gepard and try again.`,
        );
      }
      this.forget(dir);
    }
  }

  private forget(dir: string): void {
    this.lsp.forget(dir);
    this.grammar.forget(dir);
    this.theme.forget(dir);
    this.locale.forget(dir);
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
