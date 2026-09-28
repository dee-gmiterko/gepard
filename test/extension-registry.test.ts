import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadExtensionPackages } from '../src/main/extensions/scanner'
import {
  ExtensionRegistry,
  isLanguageExtension,
  isThemeTemplate
} from '../src/main/extensions/registry'
import * as extensionsStore from '../src/main/store/extensions'
import { __setUserDataDir } from './support/electron'
import { makeTmpDir, type TmpDir } from './support/tmp'

async function writePackage(
  root: string,
  name: string,
  body: string,
  manifestOverrides: Record<string, unknown> = {}
): Promise<string> {
  const pkgDir = join(root, name)
  await mkdir(pkgDir, { recursive: true })
  await writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      main: 'index.js',
      gepard: { type: 'lsp' },
      ...manifestOverrides
    })
  )
  await writeFile(join(pkgDir, 'index.js'), body)
  return pkgDir
}

const DEMO_LANG_BODY = `module.exports = {
  id: 'demo-lang',
  displayName: 'Demo Lang',
  matches: (f) => f.endsWith('.demo'),
  resolve: async () => ({ command: 'true', args: [], cwd: '.' })
}`

const THEME_COLOR_KEYS = [
  'bg',
  'bgSubtle',
  'bgElevated',
  'bgHover',
  'bgSelected',
  'fg',
  'fgMuted',
  'fgSubtle',
  'border',
  'borderStrong',
  'accent',
  'accentFg',
  'danger',
  'success',
  'warning',
  'diffAddBg',
  'diffAddFg',
  'diffDelBg',
  'diffDelFg',
  'diffHunk',
  'commentBg',
  'overlay'
]
const THEME_SYNTAX_KEYS = [
  'keyword',
  'string',
  'number',
  'comment',
  'type',
  'function',
  'property',
  'constant',
  'tag',
  'invalid'
]

const DEMO_THEME_BODY = `const colorKeys = ${JSON.stringify(THEME_COLOR_KEYS)}
const syntaxKeys = ${JSON.stringify(THEME_SYNTAX_KEYS)}
module.exports = {
  id: 'demo-theme',
  name: 'Demo Theme',
  mode: 'dark',
  shadow: { popover: '0 0 0', floating: '0 0 0' },
  colors: Object.fromEntries(colorKeys.map((k) => [k, '#000000'])),
  syntax: Object.fromEntries(syntaxKeys.map((k) => [k, '#000000']))
}`

describe('loadExtensionPackages', () => {
  let dir: TmpDir

  afterEach(async () => {
    await dir?.cleanup()
  })

  it('returns empty loaded/failed when the directory does not exist', async () => {
    const result = await loadExtensionPackages(
      '/nonexistent/path/for/sure',
      'lsp',
      isLanguageExtension
    )
    expect(result.loaded).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.cache.size).toBe(0)
  })

  it('loads a conforming package, reports a wrong-shaped one, and one that throws on import', async () => {
    dir = await makeTmpDir('ext-scan')

    await writePackage(dir.path, 'good', DEMO_LANG_BODY)
    await writePackage(dir.path, 'bad-shape', `module.exports = { id: 'bad-shape' }`)
    await writePackage(dir.path, 'throws', `throw new Error('boom during import')`)
    await mkdir(join(dir.path, 'not-a-package'), { recursive: true })

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension)

    expect(loaded).toHaveLength(1)
    expect(loaded[0].extension.id).toBe('demo-lang')
    expect(loaded[0].extension.matches('a.demo')).toBe(true)
    expect(loaded[0].dir).toBe(join(dir.path, 'good'))

    expect(failed).toHaveLength(3)
    const byDir = new Map(failed.map((f) => [f.dir, f.error]))
    expect(byDir.get(join(dir.path, 'bad-shape'))).toBe(
      'module does not export a valid "lsp" extension'
    )
    expect(byDir.get(join(dir.path, 'throws'))).toContain('boom during import')
    expect(byDir.get(join(dir.path, 'not-a-package'))).toContain('package.json')
  })

  it('reports a package whose manifest "gepard.type" does not match the requested kind', async () => {
    dir = await makeTmpDir('ext-scan-wrong-type')
    await writePackage(dir.path, 'a-theme', DEMO_LANG_BODY, { gepard: { type: 'theme' } })

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension)
    expect(loaded).toEqual([])
    expect(failed).toHaveLength(1)
    expect(failed[0].error).toContain('gepard.type')
  })

  it('loads a theme package with the same scanner, keyed off "theme" instead of "lsp"', async () => {
    dir = await makeTmpDir('ext-scan-theme')
    await writePackage(dir.path, 'demo-theme', DEMO_THEME_BODY, { gepard: { type: 'theme' } })

    const { loaded, failed } = await loadExtensionPackages(dir.path, 'theme', isThemeTemplate)
    expect(failed).toEqual([])
    expect(loaded).toHaveLength(1)
    expect(loaded[0].extension.id).toBe('demo-theme')
    expect(loaded[0].extension.mode).toBe('dark')
  })

  it('never re-imports a path once it has succeeded, threading the cache through repeated scans', async () => {
    dir = await makeTmpDir('ext-scan-once')
    const counterFile = join(dir.path, 'counter.txt')
    await writeFile(counterFile, '')
    await writePackage(
      dir.path,
      'ext',
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')\n${DEMO_LANG_BODY}`
    )

    const first = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension)
    expect(first.loaded).toHaveLength(1)
    expect((await readFile(counterFile, 'utf8')).length).toBe(1)

    const second = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension, first.cache)
    expect(second.loaded).toHaveLength(1)
    expect(second.loaded[0].extension).toBe(first.loaded[0].extension)
    expect((await readFile(counterFile, 'utf8')).length).toBe(1)
  })

  it('keeps reporting a failed path as failed on a later scan, since a fix on disk is never re-imported', async () => {
    dir = await makeTmpDir('ext-scan-stale-failure')
    const pkgDir = await writePackage(dir.path, 'ext', `module.exports = { id: 'incomplete' }`)

    const first = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension)
    expect(first.loaded).toHaveLength(0)
    expect(first.failed).toHaveLength(1)

    await writeFile(join(pkgDir, 'index.js'), DEMO_LANG_BODY)
    const second = await loadExtensionPackages(dir.path, 'lsp', isLanguageExtension, first.cache)
    expect(second.loaded).toHaveLength(0)
    expect(second.failed).toHaveLength(1)
    expect(second.failed[0].error).toBe(first.failed[0].error)
  })

  it('never imports a package already known to be disabled', async () => {
    dir = await makeTmpDir('ext-scan-disabled-skip')
    const counterFile = join(dir.path, 'counter.txt')
    await writeFile(counterFile, '')
    const pkgDir = await writePackage(
      dir.path,
      'ext',
      `require('node:fs').appendFileSync(${JSON.stringify(counterFile)}, 'x')\n${DEMO_LANG_BODY}`
    )

    const known = new Map([[pkgDir, { id: 'demo-lang', displayName: 'Demo Lang' }]])
    const result = await loadExtensionPackages(
      dir.path,
      'lsp',
      isLanguageExtension,
      new Map(),
      known,
      () => false
    )

    expect(result.loaded).toEqual([])
    expect(result.disabled).toEqual([{ dir: pkgDir, id: 'demo-lang', displayName: 'Demo Lang' }])
    expect((await readFile(counterFile, 'utf8')).length).toBe(0)
  })

  it('re-checks enabled state on every scan, so a known package is imported as soon as it is enabled', async () => {
    dir = await makeTmpDir('ext-scan-disabled-then-enabled')
    const pkgDir = await writePackage(dir.path, 'ext', DEMO_LANG_BODY)
    const known = new Map([[pkgDir, { id: 'demo-lang', displayName: 'Demo Lang' }]])

    const first = await loadExtensionPackages(
      dir.path,
      'lsp',
      isLanguageExtension,
      new Map(),
      known,
      () => false
    )
    expect(first.loaded).toEqual([])
    expect(first.disabled).toHaveLength(1)

    const second = await loadExtensionPackages(
      dir.path,
      'lsp',
      isLanguageExtension,
      first.cache,
      known,
      () => true
    )
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

  it('lists the real built-in lsp and theme packages, enabled by default, with no extensions directory', async () => {
    userData = await makeTmpDir('ext-registry-builtin')
    __setUserDataDir(userData.path)

    const registry = new ExtensionRegistry(join(userData.path, 'extensions'))
    const list = await registry.list()

    expect(list).toEqual(
      expect.arrayContaining([
        {
          id: 'typescript',
          displayName: 'TypeScript',
          kind: 'lsp',
          source: 'builtin',
          enabled: true
        },
        { id: 'light', displayName: 'Light', kind: 'theme', source: 'builtin', enabled: true },
        { id: 'dark', displayName: 'Dark', kind: 'theme', source: 'builtin', enabled: true }
      ])
    )

    const languageExtensions = await registry.enabledLanguageExtensions()
    expect(languageExtensions.map((e) => e.id)).toEqual(['typescript'])

    const themeTemplates = await registry.enabledThemeTemplates()
    expect(themeTemplates.map((t) => t.id).sort()).toEqual(['dark', 'light'])
  })

  it('setEnabled(false) persists per id and is reflected by list() and the enabled*() accessors', async () => {
    userData = await makeTmpDir('ext-registry-disable')
    __setUserDataDir(userData.path)

    const registry = new ExtensionRegistry(join(userData.path, 'extensions'))
    const updated = await registry.setEnabled('dark', false)
    const darkEntry = updated.find((e) => e.id === 'dark')
    expect(darkEntry).toEqual({
      id: 'dark',
      displayName: 'Dark',
      kind: 'theme',
      source: 'builtin',
      enabled: false
    })

    const reopened = new ExtensionRegistry(join(userData.path, 'extensions'))
    expect((await reopened.enabledThemeTemplates()).map((t) => t.id)).toEqual(['light'])
    expect((await reopened.enabledLanguageExtensions()).map((e) => e.id)).toEqual(['typescript'])
    expect((await extensionsStore.getEnabledMap()).dark).toBe(false)
  })

  it('picks up an external package of either kind dropped into its own extensions/<kind> directory', async () => {
    userData = await makeTmpDir('ext-registry-external')
    __setUserDataDir(userData.path)
    const extRoot = join(userData.path, 'extensions')
    await writePackage(join(extRoot, 'lsp'), 'demo', DEMO_LANG_BODY)
    await writePackage(join(extRoot, 'themes'), 'demo-theme', DEMO_THEME_BODY, {
      gepard: { type: 'theme' }
    })

    const registry = new ExtensionRegistry(extRoot)
    const list = await registry.list()
    expect(list).toEqual(
      expect.arrayContaining([
        {
          id: 'demo-lang',
          displayName: 'Demo Lang',
          kind: 'lsp',
          source: 'external',
          enabled: true
        },
        {
          id: 'demo-theme',
          displayName: 'Demo Theme',
          kind: 'theme',
          source: 'external',
          enabled: true
        }
      ])
    )

    const languageIds = (await registry.enabledLanguageExtensions()).map((e) => e.id).sort()
    expect(languageIds).toEqual(['demo-lang', 'typescript'])
    const themeIds = (await registry.enabledThemeTemplates()).map((t) => t.id).sort()
    expect(themeIds).toEqual(['dark', 'demo-theme', 'light'])

    await registry.setEnabled('demo-theme', false)
    expect((await registry.enabledThemeTemplates()).map((t) => t.id).sort()).toEqual([
      'dark',
      'light'
    ])
  })

  it('lists a broken external package as an unresolvable, disabled entry without affecting the others', async () => {
    userData = await makeTmpDir('ext-registry-broken')
    __setUserDataDir(userData.path)
    const extRoot = join(userData.path, 'extensions')
    await writePackage(join(extRoot, 'lsp'), 'broken', `throw new Error('nope')`)

    const registry = new ExtensionRegistry(extRoot)
    const list = await registry.list()

    const typescriptEntry = list.find((e) => e.id === 'typescript')
    expect(typescriptEntry).toMatchObject({ kind: 'lsp', source: 'builtin', enabled: true })
    const brokenEntry = list.find((e) => e.source === 'external')
    expect(brokenEntry).toMatchObject({
      kind: 'lsp',
      enabled: false,
      error: expect.stringContaining('nope')
    })
  })

  it('installs a package folder into the extensions/<kind> directory matching its manifest', async () => {
    userData = await makeTmpDir('ext-registry-install')
    __setUserDataDir(userData.path)
    const extRoot = join(userData.path, 'extensions')
    const source = await makeTmpDir('ext-registry-install-src')
    try {
      const lspPkgDir = await writePackage(source.path, 'demo', DEMO_LANG_BODY)
      const themePkgDir = await writePackage(source.path, 'demo-theme', DEMO_THEME_BODY, {
        gepard: { type: 'theme' }
      })

      const registry = new ExtensionRegistry(extRoot)
      const afterLsp = await registry.install(lspPkgDir)
      expect(afterLsp).toEqual(
        expect.arrayContaining([
          {
            id: 'demo-lang',
            displayName: 'Demo Lang',
            kind: 'lsp',
            source: 'external',
            enabled: true
          }
        ])
      )
      const afterTheme = await registry.install(themePkgDir)
      expect(afterTheme).toEqual(
        expect.arrayContaining([
          {
            id: 'demo-theme',
            displayName: 'Demo Theme',
            kind: 'theme',
            source: 'external',
            enabled: true
          }
        ])
      )

      await expect(registry.install(lspPkgDir)).rejects.toThrow(/already exists/)
    } finally {
      await source.cleanup()
    }
  })

  it('rejects installing a package whose manifest has no valid "gepard.type"', async () => {
    userData = await makeTmpDir('ext-registry-install-invalid')
    __setUserDataDir(userData.path)
    const extRoot = join(userData.path, 'extensions')
    const source = await makeTmpDir('ext-registry-install-invalid-src')
    try {
      const pkgDir = await writePackage(source.path, 'demo', DEMO_LANG_BODY, {
        gepard: { type: 'not-a-kind' }
      })

      const registry = new ExtensionRegistry(extRoot)
      await expect(registry.install(pkgDir)).rejects.toThrow(/gepard/)
    } finally {
      await source.cleanup()
    }
  })

  it('rescans on every list()/enabled*() call, so a newly dropped package is picked up without restarting', async () => {
    userData = await makeTmpDir('ext-registry-rescan')
    __setUserDataDir(userData.path)
    const extRoot = join(userData.path, 'extensions')

    const registry = new ExtensionRegistry(extRoot)
    expect((await registry.list()).map((e) => e.id).sort()).toEqual(['dark', 'light', 'typescript'])

    await writePackage(
      join(extRoot, 'lsp'),
      'late',
      `module.exports = {
      id: 'late-lang',
      displayName: 'Late Lang',
      matches: () => false,
      resolve: async () => ({})
    }`
    )

    const ids = (await registry.list()).map((e) => e.id).sort()
    expect(ids).toEqual(['dark', 'late-lang', 'light', 'typescript'])
  })
})
