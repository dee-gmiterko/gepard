import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ExtensionRegistry, loadExternalExtensions } from '../src/main/lsp/registry'
import * as extensionsStore from '../src/main/store/extensions'
import { __setUserDataDir } from './support/electron'
import { makeTmpDir, type TmpDir } from './support/tmp'

describe('loadExternalExtensions', () => {
  let dir: TmpDir

  afterEach(async () => {
    await dir?.cleanup()
  })

  it('returns empty loaded/failed when the directory does not exist', async () => {
    const result = await loadExternalExtensions('/nonexistent/path/for/sure')
    expect(result.loaded).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.cache.size).toBe(0)
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

  it('never re-imports a path once it has succeeded, threading the cache through repeated scans', async () => {
    dir = await makeTmpDir('ext-scan-once')
    const counterFile = join(dir.path, 'counter.txt')
    const extFile = join(dir.path, 'ext.js')
    await writeFile(counterFile, '')
    await writeFile(
      extFile,
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')
      module.exports = {
        id: 'demo-lang',
        displayName: 'Demo Lang',
        matches: () => false,
        resolve: async () => ({}),
        start: async () => ({})
      }`
    )

    const first = await loadExternalExtensions(dir.path)
    expect(first.loaded).toHaveLength(1)
    expect((await readFile(counterFile, 'utf8')).length).toBe(1)

    const second = await loadExternalExtensions(dir.path, first.cache)
    expect(second.loaded).toHaveLength(1)
    expect(second.loaded[0].extension).toBe(first.loaded[0].extension)
    expect((await readFile(counterFile, 'utf8')).length).toBe(1)
  })

  it('keeps reporting a failed path as failed on a later scan, since a fix on disk is never re-imported', async () => {
    dir = await makeTmpDir('ext-scan-stale-failure')
    const extFile = join(dir.path, 'ext.js')
    await writeFile(extFile, `module.exports = { id: 'incomplete' }`)

    const first = await loadExternalExtensions(dir.path)
    expect(first.loaded).toHaveLength(0)
    expect(first.failed).toHaveLength(1)

    await writeFile(
      extFile,
      `module.exports = {
        id: 'now-complete',
        displayName: 'Now Complete',
        matches: () => false,
        resolve: async () => ({}),
        start: async () => ({})
      }`
    )
    const second = await loadExternalExtensions(dir.path, first.cache)
    expect(second.loaded).toHaveLength(0)
    expect(second.failed).toHaveLength(1)
    expect(second.failed[0].error).toBe(first.failed[0].error)
  })

  it('never imports a file already known to be disabled', async () => {
    dir = await makeTmpDir('ext-scan-disabled-skip')
    const counterFile = join(dir.path, 'counter.txt')
    const extFile = join(dir.path, 'ext.js')
    await writeFile(counterFile, '')
    await writeFile(
      extFile,
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')
      module.exports = {
        id: 'demo-lang',
        displayName: 'Demo Lang',
        matches: () => false,
        resolve: async () => ({}),
        start: async () => ({})
      }`
    )

    const known = new Map([[extFile, { id: 'demo-lang', displayName: 'Demo Lang' }]])
    const result = await loadExternalExtensions(dir.path, new Map(), known, () => false)

    expect(result.loaded).toEqual([])
    expect(result.disabled).toEqual([{ file: extFile, id: 'demo-lang', displayName: 'Demo Lang' }])
    expect((await readFile(counterFile, 'utf8')).length).toBe(0)
  })

  it('re-checks enabled state on every scan, so a known file is imported as soon as it is enabled', async () => {
    dir = await makeTmpDir('ext-scan-disabled-then-enabled')
    const extFile = join(dir.path, 'ext.js')
    await writeFile(
      extFile,
      `module.exports = {
        id: 'demo-lang',
        displayName: 'Demo Lang',
        matches: () => false,
        resolve: async () => ({}),
        start: async () => ({})
      }`
    )
    const known = new Map([[extFile, { id: 'demo-lang', displayName: 'Demo Lang' }]])

    const first = await loadExternalExtensions(dir.path, new Map(), known, () => false)
    expect(first.loaded).toEqual([])
    expect(first.disabled).toHaveLength(1)

    const second = await loadExternalExtensions(dir.path, first.cache, known, () => true)
    expect(second.disabled).toEqual([])
    expect(second.loaded).toHaveLength(1)
    expect(second.loaded[0].extension.id).toBe('demo-lang')
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
    expect((await extensionsStore.getEnabledMap()).typescript).toBe(false)
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

  it('never imports an extension file already known and disabled from a previous session', async () => {
    userData = await makeTmpDir('ext-registry-seeded-disabled')
    __setUserDataDir(userData.path)
    const extDir = join(userData.path, 'extensions')
    await mkdir(extDir, { recursive: true })
    const counterFile = join(extDir, 'counter.txt')
    await writeFile(counterFile, '')
    const extFile = join(extDir, 'demo.js')
    await writeFile(
      extFile,
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')
      module.exports = {
        id: 'demo-lang',
        displayName: 'Demo Lang',
        matches: () => false,
        resolve: async () => ({}),
        start: async () => ({})
      }`
    )

    await extensionsStore.setKnownFiles({
      [extFile]: { id: 'demo-lang', displayName: 'Demo Lang' }
    })
    await extensionsStore.setEnabled('demo-lang', false)

    const registry = new ExtensionRegistry(extDir)
    const list = await registry.list()

    expect((await readFile(counterFile, 'utf8')).length).toBe(0)
    expect(list).toEqual(
      expect.arrayContaining([
        { id: 'demo-lang', displayName: 'Demo Lang', source: 'external', enabled: false }
      ])
    )
    expect((await registry.enabledExtensions()).map((e) => e.id)).toEqual(['typescript'])
    expect((await readFile(counterFile, 'utf8')).length).toBe(0)

    await registry.setEnabled('demo-lang', true)
    expect((await registry.enabledExtensions()).map((e) => e.id).sort()).toEqual([
      'demo-lang',
      'typescript'
    ])
    expect((await readFile(counterFile, 'utf8')).length).toBe(1)
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
