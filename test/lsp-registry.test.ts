import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ExtensionRegistry,
  isLanguageExtension,
  loadExternalExtensions
} from '../src/main/lsp/registry'
import * as extensionsStore from '../src/main/store/extensions'
import { __setUserDataDir } from './support/electron'
import { makeTmpDir, type TmpDir } from './support/tmp'

const validExtensionShape = {
  id: 'demo-lang',
  displayName: 'Demo Lang',
  matches: () => true,
  resolve: async () => ({}),
  start: async () => ({})
}

describe('isLanguageExtension', () => {
  it('accepts a value with the full LanguageExtension shape', () => {
    expect(isLanguageExtension(validExtensionShape)).toBe(true)
  })

  it('rejects null/undefined/non-objects', () => {
    expect(isLanguageExtension(null)).toBe(false)
    expect(isLanguageExtension(undefined)).toBe(false)
    expect(isLanguageExtension('typescript')).toBe(false)
    expect(isLanguageExtension(42)).toBe(false)
  })

  it('rejects an object missing any required member', () => {
    for (const omit of ['id', 'displayName', 'matches', 'resolve', 'start'] as const) {
      const rest: Record<string, unknown> = { ...validExtensionShape }
      delete rest[omit]
      expect(isLanguageExtension(rest)).toBe(false)
    }
  })

  it('rejects a blank id', () => {
    expect(isLanguageExtension({ ...validExtensionShape, id: '' })).toBe(false)
  })

  it('rejects members that are the wrong type (e.g. matches as a non-function)', () => {
    expect(isLanguageExtension({ ...validExtensionShape, matches: 'not a function' })).toBe(false)
  })
})

describe('loadExternalExtensions', () => {
  let dir: TmpDir

  afterEach(async () => {
    await dir?.cleanup()
  })

  it('returns empty loaded/failed when the directory does not exist', async () => {
    const result = await loadExternalExtensions('/nonexistent/path/for/sure')
    expect(result).toEqual({ loaded: [], failed: [] })
  })

  it('loads a conforming module, reports a wrong-shaped one, and reports one that throws on import', async () => {
    dir = await makeTmpDir('ext-scan')

    await writeFile(
      join(dir.path, 'good.js'),
      `module.exports = {
        id: 'demo-lang',
        displayName: 'Demo Lang',
        matches: (f) => f.endsWith('.demo'),
        resolve: async () => ({ command: 'true', args: [], cwd: '.', source: 'bundled' }),
        start: async () => ({})
      }`
    )
    await writeFile(join(dir.path, 'bad-shape.js'), `module.exports = { id: 'bad-shape' }`)
    await writeFile(join(dir.path, 'throws.js'), `throw new Error('boom during import')`)
    await writeFile(join(dir.path, 'README.md'), 'not an extension')

    const { loaded, failed } = await loadExternalExtensions(dir.path)

    expect(loaded).toHaveLength(1)
    expect(loaded[0].extension.id).toBe('demo-lang')
    expect(loaded[0].extension.matches('a.demo')).toBe(true)
    expect(loaded[0].file).toBe(join(dir.path, 'good.js'))

    expect(failed).toHaveLength(2)
    const byFile = new Map(failed.map((f) => [f.file, f.error]))
    expect(byFile.get(join(dir.path, 'bad-shape.js'))).toBe(
      'module does not export a LanguageExtension'
    )
    expect(byFile.get(join(dir.path, 'throws.js'))).toContain('boom during import')
  })
})

describe('ExtensionRegistry', () => {
  let userData: TmpDir

  afterEach(async () => {
    await userData?.cleanup()
  })

  it('lists the built-in TypeScript extension, enabled by default, with no extensions directory', async () => {
    userData = await makeTmpDir('ext-registry-builtin')
    __setUserDataDir(userData.path)

    const registry = new ExtensionRegistry(join(userData.path, 'extensions'))
    const list = await registry.list()

    expect(list).toEqual([
      { id: 'typescript', displayName: 'TypeScript', source: 'builtin', enabled: true }
    ])

    const enabled = await registry.enabledExtensions()
    expect(enabled.map((e) => e.id)).toEqual(['typescript'])
  })

  it('setEnabled(false) persists and is reflected by both list() and enabledExtensions()', async () => {
    userData = await makeTmpDir('ext-registry-disable')
    __setUserDataDir(userData.path)

    const registry = new ExtensionRegistry(join(userData.path, 'extensions'))
    const updated = await registry.setEnabled('typescript', false)
    expect(updated).toEqual([
      { id: 'typescript', displayName: 'TypeScript', source: 'builtin', enabled: false }
    ])

    const reopened = new ExtensionRegistry(join(userData.path, 'extensions'))
    expect(await reopened.enabledExtensions()).toEqual([])
    expect(await extensionsStore.isEnabled('typescript')).toBe(false)
  })

  it('picks up an external extension dropped into the extensions directory, enabled by default', async () => {
    userData = await makeTmpDir('ext-registry-external')
    __setUserDataDir(userData.path)
    const extDir = join(userData.path, 'extensions')
    await mkdir(extDir, { recursive: true })
    await writeFile(
      join(extDir, 'demo.js'),
      `module.exports = {
        id: 'demo-lang',
        displayName: 'Demo Lang',
        matches: (f) => f.endsWith('.demo'),
        resolve: async () => ({ command: 'true', args: [], cwd: '.', source: 'bundled' }),
        start: async () => ({})
      }`
    )

    const registry = new ExtensionRegistry(extDir)
    const list = await registry.list()
    expect(list).toEqual(
      expect.arrayContaining([
        { id: 'typescript', displayName: 'TypeScript', source: 'builtin', enabled: true },
        { id: 'demo-lang', displayName: 'Demo Lang', source: 'external', enabled: true }
      ])
    )

    const enabledIds = (await registry.enabledExtensions()).map((e) => e.id).sort()
    expect(enabledIds).toEqual(['demo-lang', 'typescript'])

    await registry.setEnabled('demo-lang', false)
    const afterDisable = (await registry.enabledExtensions()).map((e) => e.id)
    expect(afterDisable).toEqual(['typescript'])
  })

  it('lists a broken external module as an unresolvable, disabled entry without affecting the others', async () => {
    userData = await makeTmpDir('ext-registry-broken')
    __setUserDataDir(userData.path)
    const extDir = join(userData.path, 'extensions')
    await mkdir(extDir, { recursive: true })
    await writeFile(join(extDir, 'broken.js'), `throw new Error('nope')`)

    const registry = new ExtensionRegistry(extDir)
    const list = await registry.list()

    const typescriptEntry = list.find((e) => e.id === 'typescript')
    expect(typescriptEntry).toEqual({
      id: 'typescript',
      displayName: 'TypeScript',
      source: 'builtin',
      enabled: true
    })
    const brokenEntry = list.find((e) => e.source === 'external')
    expect(brokenEntry).toMatchObject({ enabled: false, error: expect.stringContaining('nope') })

    const enabled = await registry.enabledExtensions()
    expect(enabled.map((e) => e.id)).toEqual(['typescript'])
  })

  it('rescans on every list()/enabledExtensions() call, so a newly dropped file is picked up without restarting', async () => {
    userData = await makeTmpDir('ext-registry-rescan')
    __setUserDataDir(userData.path)
    const extDir = join(userData.path, 'extensions')
    await mkdir(extDir, { recursive: true })

    const registry = new ExtensionRegistry(extDir)
    expect((await registry.list()).map((e) => e.id)).toEqual(['typescript'])

    await writeFile(
      join(extDir, 'late.js'),
      `module.exports = {
        id: 'late-lang',
        displayName: 'Late Lang',
        matches: () => false,
        resolve: async () => ({}),
        start: async () => ({})
      }`
    )

    const ids = (await registry.list()).map((e) => e.id).sort()
    expect(ids).toEqual(['late-lang', 'typescript'])
  })
})
