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

export async function loadExternalExtensions(
  dir: string
): Promise<{ loaded: LoadedExternalExtension[]; failed: FailedExternalExtension[] }> {
  const loaded: LoadedExternalExtension[] = []
  const failed: FailedExternalExtension[] = []

  let names: string[]
  try {
    names = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && LOADABLE_EXTENSION_FILE.test(e.name))
      .map((e) => e.name)
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { loaded, failed }
    failed.push({ file: dir, error: (e as Error).message })
    return { loaded, failed }
  }

  for (const name of names) {
    const file = path.join(dir, name)
    try {
      // The query string busts Node's by-URL ESM module cache so an edited
      // ES module extension reloads without an app restart. It has no effect
      // on a CommonJS extension, since Node's require/CJS interop caches by
      // resolved path and ignores the query string.
      const mod = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as Record<
        string,
        unknown
      >
      const candidate = mod.default ?? mod.extension ?? mod
      if (!isLanguageExtension(candidate)) {
        failed.push({ file, error: 'module does not export a LanguageExtension' })
        continue
      }
      loaded.push({ extension: candidate, file })
    } catch (e) {
      failed.push({ file, error: (e as Error).message })
    }
  }
  return { loaded, failed }
}

interface KnownExtension {
  extension: LanguageExtension
  source: 'builtin' | 'external'
}

export class ExtensionRegistry {
  private external: LoadedExternalExtension[] = []
  private failed: FailedExternalExtension[] = []

  constructor(private readonly dir: string = extensionsDir()) {}

  async rescan(): Promise<void> {
    const { loaded, failed } = await loadExternalExtensions(this.dir)
    this.external = loaded
    this.failed = failed
  }

  private known(): KnownExtension[] {
    return [
      ...BUILTIN_EXTENSIONS.map((extension): KnownExtension => ({ extension, source: 'builtin' })),
      ...this.external.map(({ extension }): KnownExtension => ({ extension, source: 'external' }))
    ]
  }

  async list(): Promise<ExtensionInfo[]> {
    await this.rescan()
    const enabledMap = await extensionsStore.getEnabledMap()
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
    return [...known, ...broken]
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
    await this.rescan()
    const enabledMap = await extensionsStore.getEnabledMap()
    return this.known()
      .filter(({ extension }) => enabledMap[extension.id] ?? true)
      .map(({ extension }) => extension)
  }
}

export const extensionRegistry = new ExtensionRegistry()
