import { cp, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  errorMessage,
  isErrnoException,
  isGrammarExtension,
  isLanguageExtension,
  type PackageManifest,
  type ExtensionInfo,
  type ExtensionKind,
  type GrammarModule,
  type GrammarExtension,
  type ThemeTemplateData,
  type LocaleData,
  type LanguageExtension,
} from '@gepard/common';
import { AppError } from '../ipc/registry';
import { builtinExtensionsDir, userExtensionsDir, type ExtensionKindDir } from '../paths';
import * as extensionsStore from '../store/extensions';
import * as settingsStore from '../store/settings';
import {
  loadExtensionPackages,
  readManifest,
  type DisabledExtensionPackage,
  type FailedExtensionPackage,
  type LoadedExtensionPackage,
  type ScanCache,
  type Sourced,
} from './scanner';
import { isLocaleData, isThemeTemplate } from '../helpers/extension';

interface KindSpec<T> {
  kind: ExtensionKind;
  dirName: ExtensionKindDir;
  isValid: (value: unknown) => value is T;
  getId: (item: T) => string;
  getDisplayName: (item: T) => string;
}

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

const THEME_SPEC: KindSpec<ThemeTemplateData> = {
  kind: 'theme',
  dirName: 'themes',
  isValid: isThemeTemplate,
  getId: (item) => item.id,
  getDisplayName: (item) => item.name,
};

const LOCALE_SPEC: KindSpec<LocaleData> = {
  kind: 'locale',
  dirName: 'locales',
  isValid: isLocaleData,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

interface KnownExtension<T> {
  extension: T;
  source: 'builtin' | 'external';
}

class KindRegistry<T> {
  private builtin: LoadedExtensionPackage<T>[] = [];
  private external: LoadedExtensionPackage<T>[] = [];
  private failed: Sourced<FailedExtensionPackage>[] = [];
  private allDisabled: Sourced<DisabledExtensionPackage>[] = [];
  private builtinScanCache: ScanCache<T> = new Map();
  private externalScanCache: ScanCache<T> = new Map();

  constructor(
    private readonly spec: KindSpec<T>,
    private readonly overrideUserDir?: string,
    private readonly overrideBuiltinDir?: string,
  ) {}

  private get userDir(): string {
    return this.overrideUserDir ?? userExtensionsDir(this.spec.dirName);
  }

  private get builtinDir(): string {
    return this.overrideBuiltinDir ?? builtinExtensionsDir(this.spec.dirName);
  }

  private async rescan(enabledMap: settingsStore.ExtensionsState): Promise<void> {
    const knownDirs = await extensionsStore.getKnownFiles();
    const knownMap = new Map(Object.entries(knownDirs));

    const builtinResult = await loadExtensionPackages(
      this.builtinDir,
      this.spec.kind,
      this.spec.isValid,
      this.builtinScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true,
    );
    const externalResult = await loadExtensionPackages(
      this.userDir,
      this.spec.kind,
      this.spec.isValid,
      this.externalScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true,
    );

    this.builtin = builtinResult.loaded;
    this.external = externalResult.loaded;
    this.failed = [
      ...builtinResult.failed.map((f) => ({ ...f, source: 'builtin' as const })),
      ...externalResult.failed.map((f) => ({ ...f, source: 'external' as const })),
    ];
    this.allDisabled = [
      ...builtinResult.disabled.map((d) => ({ ...d, source: 'builtin' as const })),
      ...externalResult.disabled.map((d) => ({ ...d, source: 'external' as const })),
    ];
    this.builtinScanCache = builtinResult.cache;
    this.externalScanCache = externalResult.cache;
    await this.persistKnownDirs([...builtinResult.loaded, ...externalResult.loaded], knownDirs);
  }

  private async persistKnownDirs(
    loaded: LoadedExtensionPackage<T>[],
    known: extensionsStore.KnownFilesState,
  ): Promise<void> {
    if (loaded.length === 0) return;
    const next = { ...known };
    let changed = false;
    for (const { extension, dir } of loaded) {
      const id = this.spec.getId(extension);
      const displayName = this.spec.getDisplayName(extension);
      const prev = next[dir];
      if (!prev || prev.id !== id || prev.displayName !== displayName) {
        next[dir] = { id, displayName };
        changed = true;
      }
    }
    if (changed) await extensionsStore.setKnownFiles(next);
  }

  private known(): KnownExtension<T>[] {
    return [
      ...this.builtin.map(({ extension }): KnownExtension<T> => ({ extension, source: 'builtin' })),
      ...this.external.map(({ extension }): KnownExtension<T> => ({
        extension,
        source: 'external',
      })),
    ];
  }

  async list(): Promise<ExtensionInfo[]> {
    const enabledMap = await settingsStore.getEnabledMap();
    await this.rescan(enabledMap);
    const known = this.known().map(({ extension, source }): ExtensionInfo => ({
      id: this.spec.getId(extension),
      displayName: this.spec.getDisplayName(extension),
      kind: this.spec.kind,
      source,
      enabled: enabledMap[this.spec.getId(extension)] ?? true,
    }));
    const broken = this.failed.map(({ dir, error, source }): ExtensionInfo => ({
      id: dir,
      displayName: path.basename(dir),
      kind: this.spec.kind,
      source,
      enabled: false,
      error,
    }));
    const disabled = this.allDisabled.map(({ id, displayName, source }): ExtensionInfo => ({
      id,
      displayName,
      kind: this.spec.kind,
      source,
      enabled: false,
    }));
    return [...known, ...broken, ...disabled];
  }

  async install(srcDir: string): Promise<void> {
    const name = path.basename(srcDir);
    await mkdir(this.userDir, { recursive: true });
    try {
      await cp(srcDir, path.join(this.userDir, name), {
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

  async enabledPackages(): Promise<LoadedExtensionPackage<T>[]> {
    const enabledMap = await settingsStore.getEnabledMap();
    await this.rescan(enabledMap);
    return [...this.builtin, ...this.external].filter(
      ({ extension }) => enabledMap[this.spec.getId(extension)] ?? true,
    );
  }

  async enabledExtensions(): Promise<T[]> {
    return (await this.enabledPackages()).map(({ extension }) => extension);
  }
}

export class ExtensionRegistry {
  private readonly lsp: KindRegistry<LanguageExtension>;
  private readonly grammar: KindRegistry<GrammarExtension>;
  private readonly theme: KindRegistry<ThemeTemplateData>;
  private readonly locale: KindRegistry<LocaleData>;

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

  async enabledThemeTemplates(): Promise<ThemeTemplateData[]> {
    return this.theme.enabledExtensions();
  }

  async enabledLocales(): Promise<LocaleData[]> {
    return this.locale.enabledExtensions();
  }
}

export const extensionRegistry = new ExtensionRegistry();
