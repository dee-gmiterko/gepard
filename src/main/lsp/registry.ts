import { constants as fsConstants } from 'node:fs'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ExtensionInfo } from '@shared/ipc/schemas/extensions'
import { AppError } from '../ipc/registry'
import { extensionsDir } from '../paths'
import * as extensionsStore from '../store/extensions'
import { typescriptExtension } from './extensions/typescript'
import type { LanguageExtension } from './session'

const BUILTIN_EXTENSIONS: LanguageExtension[] = [typescriptExtension]

const LOADABLE_EXTENSION_FILE = /\.(mjs|cjs|js)$/

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
    isFn(v.resolve) &&
    isFn(v.start)
  )
}

export interface LoadedExternalExtension {
  extension: LanguageExtension
  file: string
}

export interface FailedExternalExtension {
  file: string
  error: string
}

export interface DisabledExternalExtension {
  file: string
  id: string
  displayName: string
}

type ScanEntry =
  { extension: LanguageExtension } | { error: string } | { disabled: extensionsStore.KnownFile }

// Node never re-evaluates a module once it has imported its URL, whether that
// import succeeded or failed, so a path already scanned is never imported
// again.
export async function loadExternalExtensions(
  dir: string,
  previous: ReadonlyMap<string, ScanEntry> = new Map(),
  knownFiles: ReadonlyMap<string, extensionsStore.KnownFile> = new Map(),
  isEnabled: (id: string) => boolean = () => true
): Promise<{
  loaded: LoadedExternalExtension[]
  failed: FailedExternalExtension[]
  disabled: DisabledExternalExtension[]
  cache: Map<string, ScanEntry>
}> {
  const loaded: LoadedExternalExtension[] = []
  const failed: FailedExternalExtension[] = []
  const disabled: DisabledExternalExtension[] = []
  const cache = new Map<string, ScanEntry>()

  let names: string[]
  try {
    names = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && LOADABLE_EXTENSION_FILE.test(e.name))
      .map((e) => e.name)
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { loaded, failed, disabled, cache }
    failed.push({ file: dir, error: (e as Error).message })
    return { loaded, failed, disabled, cache }
  }

  for (const name of names) {
    const file = path.join(dir, name)

    const prior = previous.get(file)
    if (prior && 'extension' in prior) {
      cache.set(file, prior)
      loaded.push({ extension: prior.extension, file })
      continue
    }
    if (prior && 'error' in prior) {
      cache.set(file, prior)
      failed.push({ file, error: prior.error })
      continue
    }

    // A file whose id/displayName is already known, either from this
    // session's own cache or from a previous run, never needs importing to
    // be reported as disabled: only enabling it requires reading its code.
    const known = prior && 'disabled' in prior ? prior.disabled : knownFiles.get(file)
    if (known && !isEnabled(known.id)) {
      const entry: ScanEntry = { disabled: known }
      cache.set(file, entry)
      disabled.push({ file, id: known.id, displayName: known.displayName })
      continue
    }

    try {
      const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>
      const candidate = mod.default ?? mod.extension ?? mod
      if (!isLanguageExtension(candidate)) {
        const entry: ScanEntry = { error: 'module does not export a LanguageExtension' }
        cache.set(file, entry)
        failed.push({ file, error: entry.error })
        continue
      }
      const entry: ScanEntry = { extension: candidate }
      cache.set(file, entry)
      loaded.push({ extension: candidate, file })
    } catch (e) {
      const entry: ScanEntry = { error: (e as Error).message }
      cache.set(file, entry)
      failed.push({ file, error: entry.error })
    }
  }
  return { loaded, failed, disabled, cache }
}

interface KnownExtension {
  extension: LanguageExtension
  source: 'builtin' | 'external'
}

export class ExtensionRegistry {
  private external: LoadedExternalExtension[] = []
  private failed: FailedExternalExtension[] = []
  private disabledExternal: DisabledExternalExtension[] = []
  private scanCache = new Map<string, ScanEntry>()

  constructor(private readonly overrideDir?: string) {}

  private get dir(): string {
    return this.overrideDir ?? extensionsDir()
  }

  private async rescan(enabledMap: extensionsStore.ExtensionsState): Promise<void> {
    const knownFiles = await extensionsStore.getKnownFiles()
    const { loaded, failed, disabled, cache } = await loadExternalExtensions(
      this.dir,
      this.scanCache,
      new Map(Object.entries(knownFiles)),
      (id) => enabledMap[id] ?? true
    )
    this.external = loaded
    this.failed = failed
    this.disabledExternal = disabled
    this.scanCache = cache
    await this.persistKnownFiles(loaded, knownFiles)
  }

  private async persistKnownFiles(
    loaded: LoadedExternalExtension[],
    known: extensionsStore.KnownFilesState
  ): Promise<void> {
    if (loaded.length === 0) return
    const next = { ...known }
    let changed = false
    for (const { extension, file } of loaded) {
      const prev = next[file]
      if (!prev || prev.id !== extension.id || prev.displayName !== extension.displayName) {
        next[file] = { id: extension.id, displayName: extension.displayName }
        changed = true
      }
    }
    if (changed) await extensionsStore.setKnownFiles(next)
  }

  private known(): KnownExtension[] {
    return [
      ...BUILTIN_EXTENSIONS.map((extension): KnownExtension => ({ extension, source: 'builtin' })),
      ...this.external.map(({ extension }): KnownExtension => ({ extension, source: 'external' }))
    ]
  }

  async list(): Promise<ExtensionInfo[]> {
    const enabledMap = await extensionsStore.getEnabledMap()
    await this.rescan(enabledMap)
    const known = this.known().map(({ extension, source }): ExtensionInfo => ({
      id: extension.id,
      displayName: extension.displayName,
      source,
      enabled: enabledMap[extension.id] ?? true
    }))
    const broken = this.failed.map(({ file, error }): ExtensionInfo => ({
      id: file,
      displayName: path.basename(file),
      source: 'external',
      enabled: false,
      error
    }))
    const disabled = this.disabledExternal.map(({ id, displayName }): ExtensionInfo => ({
      id,
      displayName,
      source: 'external',
      enabled: false
    }))
    return [...known, ...broken, ...disabled]
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionInfo[]> {
    await extensionsStore.setEnabled(id, enabled)
    return this.list()
  }

  async install(srcPath: string): Promise<ExtensionInfo[]> {
    const name = path.basename(srcPath)
    if (!LOADABLE_EXTENSION_FILE.test(name)) {
      throw new AppError(
        'EXTENSION_INVALID_FILE',
        `${name} is not a .js/.mjs/.cjs extension module`
      )
    }
    await mkdir(this.dir, { recursive: true })
    try {
      await copyFile(srcPath, path.join(this.dir, name), fsConstants.COPYFILE_EXCL)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new AppError(
          'EXTENSION_ALREADY_EXISTS',
          `An extension named "${name}" already exists.`
        )
      }
      throw e
    }
    return this.list()
  }

  async enabledExtensions(): Promise<LanguageExtension[]> {
    const enabledMap = await extensionsStore.getEnabledMap()
    await this.rescan(enabledMap)
    return this.known()
      .filter(({ extension }) => enabledMap[extension.id] ?? true)
      .map(({ extension }) => extension)
  }
}

export const extensionRegistry = new ExtensionRegistry()
