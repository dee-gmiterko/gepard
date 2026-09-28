import { cp, mkdir } from 'node:fs/promises'
import * as path from 'node:path'
import type { ExtensionInfo, ExtensionKind } from '@shared/ipc/schemas/extensions'
import { ThemeTemplateData } from '@shared/ipc/schemas/theme'
import { AppError } from '../ipc/registry'
import { builtinExtensionsDir, userExtensionsDir, type ExtensionKindDir } from '../paths'
import * as extensionsStore from '../store/extensions'
import type { LanguageExtension } from '../lsp/session'
import {
  loadExtensionPackages,
  readManifest,
  type DisabledExtensionPackage,
  type FailedExtensionPackage,
  type LoadedExtensionPackage,
  type PackageManifest,
  type ScanCache,
  type Sourced
} from './scanner'

function isFn(v: unknown): v is (...args: never[]) => unknown {
  return typeof v === 'function'
}

export function isLanguageExtension(value: unknown): value is LanguageExtension {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.displayName === 'string' &&
    isFn(v.matches) &&
    isFn(v.resolve)
  )
}

export function isThemeTemplate(value: unknown): value is ThemeTemplateData {
  return ThemeTemplateData.safeParse(value).success
}

interface KindSpec<T> {
  kind: ExtensionKind
  dirName: ExtensionKindDir
  isValid: (value: unknown) => value is T
  getId: (item: T) => string
  getDisplayName: (item: T) => string
}

const LSP_SPEC: KindSpec<LanguageExtension> = {
  kind: 'lsp',
  dirName: 'lsp',
  isValid: isLanguageExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName
}

const THEME_SPEC: KindSpec<ThemeTemplateData> = {
  kind: 'theme',
  dirName: 'themes',
  isValid: isThemeTemplate,
  getId: (item) => item.id,
  getDisplayName: (item) => item.name
}

interface KnownExtension<T> {
  extension: T
  source: 'builtin' | 'external'
}

class KindRegistry<T> {
  private builtin: LoadedExtensionPackage<T>[] = []
  private external: LoadedExtensionPackage<T>[] = []
  private failed: Sourced<FailedExtensionPackage>[] = []
  private allDisabled: Sourced<DisabledExtensionPackage>[] = []
  private builtinScanCache: ScanCache<T> = new Map()
  private externalScanCache: ScanCache<T> = new Map()

  constructor(
    private readonly spec: KindSpec<T>,
    private readonly overrideUserDir?: string
  ) {}

  private get userDir(): string {
    return this.overrideUserDir ?? userExtensionsDir(this.spec.dirName)
  }

  private async rescan(enabledMap: extensionsStore.ExtensionsState): Promise<void> {
    const knownDirs = await extensionsStore.getKnownFiles()
    const knownMap = new Map(Object.entries(knownDirs))

    const builtinResult = await loadExtensionPackages(
      builtinExtensionsDir(this.spec.dirName),
      this.spec.kind,
      this.spec.isValid,
      this.builtinScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true
    )
    const externalResult = await loadExtensionPackages(
      this.userDir,
      this.spec.kind,
      this.spec.isValid,
      this.externalScanCache,
      knownMap,
      (id) => enabledMap[id] ?? true
    )

    this.builtin = builtinResult.loaded
    this.external = externalResult.loaded
    this.failed = [
      ...builtinResult.failed.map((f) => ({ ...f, source: 'builtin' as const })),
      ...externalResult.failed.map((f) => ({ ...f, source: 'external' as const }))
    ]
    this.allDisabled = [
      ...builtinResult.disabled.map((d) => ({ ...d, source: 'builtin' as const })),
      ...externalResult.disabled.map((d) => ({ ...d, source: 'external' as const }))
    ]
    this.builtinScanCache = builtinResult.cache
    this.externalScanCache = externalResult.cache
    await this.persistKnownDirs([...builtinResult.loaded, ...externalResult.loaded], knownDirs)
  }

  private async persistKnownDirs(
    loaded: LoadedExtensionPackage<T>[],
    known: extensionsStore.KnownFilesState
  ): Promise<void> {
    if (loaded.length === 0) return
    const next = { ...known }
    let changed = false
    for (const { extension, dir } of loaded) {
      const id = this.spec.getId(extension)
      const displayName = this.spec.getDisplayName(extension)
      const prev = next[dir]
      if (!prev || prev.id !== id || prev.displayName !== displayName) {
        next[dir] = { id, displayName }
        changed = true
      }
    }
    if (changed) await extensionsStore.setKnownFiles(next)
  }

  private known(): KnownExtension<T>[] {
    return [
      ...this.builtin.map(({ extension }): KnownExtension<T> => ({ extension, source: 'builtin' })),
      ...this.external.map(({ extension }): KnownExtension<T> => ({
        extension,
        source: 'external'
      }))
    ]
  }

  async list(): Promise<ExtensionInfo[]> {
    const enabledMap = await extensionsStore.getEnabledMap()
    await this.rescan(enabledMap)
    const known = this.known().map(({ extension, source }): ExtensionInfo => ({
      id: this.spec.getId(extension),
      displayName: this.spec.getDisplayName(extension),
      kind: this.spec.kind,
      source,
      enabled: enabledMap[this.spec.getId(extension)] ?? true
    }))
    const broken = this.failed.map(({ dir, error, source }): ExtensionInfo => ({
      id: dir,
      displayName: path.basename(dir),
      kind: this.spec.kind,
      source,
      enabled: false,
      error
    }))
    const disabled = this.allDisabled.map(({ id, displayName, source }): ExtensionInfo => ({
      id,
      displayName,
      kind: this.spec.kind,
      source,
      enabled: false
    }))
    return [...known, ...broken, ...disabled]
  }

  async install(srcDir: string): Promise<void> {
    const name = path.basename(srcDir)
    await mkdir(this.userDir, { recursive: true })
    try {
      await cp(srcDir, path.join(this.userDir, name), {
        recursive: true,
        errorOnExist: true,
        force: false
      })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ERR_FS_CP_EEXIST') {
        throw new AppError(
          'EXTENSION_ALREADY_EXISTS',
          `An extension named "${name}" already exists.`
        )
      }
      throw e
    }
  }

  async enabledExtensions(): Promise<T[]> {
    const enabledMap = await extensionsStore.getEnabledMap()
    await this.rescan(enabledMap)
    return this.known()
      .filter(({ extension }) => enabledMap[this.spec.getId(extension)] ?? true)
      .map(({ extension }) => extension)
  }
}

export class ExtensionRegistry {
  private readonly lsp: KindRegistry<LanguageExtension>
  private readonly theme: KindRegistry<ThemeTemplateData>

  constructor(overrideUserRootDir?: string) {
    const overrideDir = (dirName: ExtensionKindDir): string | undefined =>
      overrideUserRootDir ? path.join(overrideUserRootDir, dirName) : undefined
    this.lsp = new KindRegistry(LSP_SPEC, overrideDir(LSP_SPEC.dirName))
    this.theme = new KindRegistry(THEME_SPEC, overrideDir(THEME_SPEC.dirName))
  }

  async list(): Promise<ExtensionInfo[]> {
    const [lsp, theme] = await Promise.all([this.lsp.list(), this.theme.list()])
    return [...lsp, ...theme]
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionInfo[]> {
    await extensionsStore.setEnabled(id, enabled)
    return this.list()
  }

  async install(srcDir: string): Promise<ExtensionInfo[]> {
    const name = path.basename(srcDir)
    let manifest: PackageManifest
    try {
      manifest = await readManifest(srcDir)
    } catch (e) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}" has no valid package.json (${(e as Error).message})`
      )
    }
    const type = manifest.gepard?.type
    if (type === LSP_SPEC.kind) {
      await this.lsp.install(srcDir)
    } else if (type === THEME_SPEC.kind) {
      await this.theme.install(srcDir)
    } else {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `"${name}"'s package.json must set "gepard": { "type": "lsp" | "theme" } (got ${JSON.stringify(type ?? null)})`
      )
    }
    return this.list()
  }

  async enabledLanguageExtensions(): Promise<LanguageExtension[]> {
    return this.lsp.enabledExtensions()
  }

  async enabledThemeTemplates(): Promise<ThemeTemplateData[]> {
    return this.theme.enabledExtensions()
  }
}

export const extensionRegistry = new ExtensionRegistry()
