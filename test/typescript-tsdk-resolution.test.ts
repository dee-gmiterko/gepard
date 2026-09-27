// VS Code uses its bundled TypeScript by default and only switches to a
// workspace version when `.vscode/settings.json` sets `typescript.tsdk`.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readTsdkSetting,
  resolveWorkspaceTypeScript,
  stripJsonComments
} from '../src/main/lsp/extensions/typescript'
import { makeTmpDir, type TmpDir } from './support/tmp'

describe('stripJsonComments', () => {
  it('removes line comments', () => {
    expect(stripJsonComments('{\n  "a": 1 // comment\n}')).toBe('{\n  "a": 1 \n}')
  })

  it('removes block comments', () => {
    expect(stripJsonComments('{ /* c */ "a": 1 }')).toBe('{  "a": 1 }')
  })

  it('leaves // and /* inside string values alone', () => {
    const input = '{ "a": "http://example.com", "b": "/* not a comment */" }'
    expect(JSON.parse(stripJsonComments(input))).toEqual({
      a: 'http://example.com',
      b: '/* not a comment */'
    })
  })

  it('keeps escaped quotes inside strings from ending the string early', () => {
    const input = '{ "a": "she said \\"hi // not a comment\\"" }'
    expect(JSON.parse(stripJsonComments(input))).toEqual({ a: 'she said "hi // not a comment"' })
  })
})

describe('readTsdkSetting', () => {
  let dir: TmpDir

  afterEach(async () => {
    await dir?.cleanup()
  })

  it('returns null when there is no .vscode/settings.json', async () => {
    dir = await makeTmpDir('tsdk-none')
    expect(readTsdkSetting(dir.path)).toBeNull()
  })

  it('returns null when settings.json has no typescript.tsdk key', async () => {
    dir = await makeTmpDir('tsdk-missing-key')
    await mkdir(join(dir.path, '.vscode'), { recursive: true })
    await writeFile(join(dir.path, '.vscode/settings.json'), '{ "editor.tabSize": 2 }')
    expect(readTsdkSetting(dir.path)).toBeNull()
  })

  it('returns null for invalid JSON instead of throwing', async () => {
    dir = await makeTmpDir('tsdk-bad-json')
    await mkdir(join(dir.path, '.vscode'), { recursive: true })
    await writeFile(join(dir.path, '.vscode/settings.json'), '{ not json')
    expect(readTsdkSetting(dir.path)).toBeNull()
  })

  it('reads typescript.tsdk, tolerating JSONC comments', async () => {
    dir = await makeTmpDir('tsdk-ok')
    await mkdir(join(dir.path, '.vscode'), { recursive: true })
    await writeFile(
      join(dir.path, '.vscode/settings.json'),
      '{\n  // use the workspace TypeScript\n  "typescript.tsdk": "node_modules/typescript/lib"\n}'
    )
    expect(readTsdkSetting(dir.path)).toBe('node_modules/typescript/lib')
  })

  it('returns null for a blank tsdk value', async () => {
    dir = await makeTmpDir('tsdk-blank')
    await mkdir(join(dir.path, '.vscode'), { recursive: true })
    await writeFile(join(dir.path, '.vscode/settings.json'), '{ "typescript.tsdk": "   " }')
    expect(readTsdkSetting(dir.path)).toBeNull()
  })
})

async function writeTsPackage(
  root: string,
  tsdkRelativeToPkgRoot: string,
  version: string,
  extraFiles: Record<string, string> = {}
): Promise<void> {
  const pkgRoot = join(root, tsdkRelativeToPkgRoot)
  await mkdir(pkgRoot, { recursive: true })
  await writeFile(join(pkgRoot, 'package.json'), JSON.stringify({ name: 'typescript', version }))
  for (const [rel, content] of Object.entries(extraFiles)) {
    await mkdir(join(pkgRoot, rel, '..'), { recursive: true })
    await writeFile(join(pkgRoot, rel), content)
  }
}

async function setTsdk(root: string, tsdk: string): Promise<void> {
  await mkdir(join(root, '.vscode'), { recursive: true })
  await writeFile(join(root, '.vscode/settings.json'), JSON.stringify({ 'typescript.tsdk': tsdk }))
}

describe('resolveWorkspaceTypeScript (VS Code tsdk semantics)', () => {
  let dir: TmpDir

  afterEach(async () => {
    await dir?.cleanup()
  })

  it('resolves to bundled when no typescript.tsdk is set, even if node_modules/typescript exists', async () => {
    dir = await makeTmpDir('tsdk-default-bundled')
    await writeTsPackage(dir.path, 'node_modules/typescript', '5.6.3', {
      'lib/tsserver.js': ''
    })
    expect(resolveWorkspaceTypeScript(dir.path)).toEqual({ source: 'bundled' })
  })

  it('resolves to bundled when tsdk points at a package.json-less directory', async () => {
    dir = await makeTmpDir('tsdk-dangling')
    await setTsdk(dir.path, 'node_modules/typescript/lib')
    expect(resolveWorkspaceTypeScript(dir.path)).toEqual({ source: 'bundled' })
  })

  it('resolves a 5.x tsdk to the "js" kind, locating tsserver.js next to it', async () => {
    dir = await makeTmpDir('tsdk-5x')
    await writeTsPackage(dir.path, 'node_modules/typescript', '5.6.3', {
      'lib/tsserver.js': '// tsserver',
      'lib/typescript.js': '// typescript'
    })
    await setTsdk(dir.path, 'node_modules/typescript/lib')

    const resolved = resolveWorkspaceTypeScript(dir.path)
    expect(resolved.source).toBe('workspace')
    if (resolved.source !== 'workspace') throw new Error('unreachable')
    expect(resolved.version).toBe('5.6.3')
    expect(resolved.kind).toBe('js')
    if (resolved.kind !== 'js') throw new Error('unreachable')
    expect(resolved.tsserver).toBe(join(dir.path, 'node_modules/typescript/lib/tsserver.js'))
    expect(resolved.jsApi).toBe(join(dir.path, 'node_modules/typescript/lib/typescript.js'))
  })

  it('resolves a >=7 tsdk to the "native-lsp" kind, locating the platform package', async () => {
    dir = await makeTmpDir('tsdk-7x')
    await writeTsPackage(dir.path, 'node_modules/typescript', '7.0.2')
    const platformPkg = `@typescript/typescript-${process.platform}-${process.arch}`
    const exeName = process.platform === 'win32' ? 'tsc.exe' : 'tsc'
    await mkdir(join(dir.path, 'node_modules', platformPkg, 'lib'), { recursive: true })
    await writeFile(join(dir.path, 'node_modules', platformPkg, 'lib', exeName), '')
    await setTsdk(dir.path, 'node_modules/typescript/lib')

    const resolved = resolveWorkspaceTypeScript(dir.path)
    expect(resolved.source).toBe('workspace')
    if (resolved.source !== 'workspace') throw new Error('unreachable')
    expect(resolved.kind).toBe('native-lsp')
    if (resolved.kind !== 'native-lsp') throw new Error('unreachable')
    expect(resolved.exe).toBe(join(dir.path, 'node_modules', platformPkg, 'lib', exeName))
    expect(resolved.lspArgs).toEqual(['--lsp', '--stdio'])
  })

  it('a >=7 tsdk with no platform package present resolves exe to null (falls back to bundled at launch)', async () => {
    dir = await makeTmpDir('tsdk-7x-no-native')
    await writeTsPackage(dir.path, 'node_modules/typescript', '7.0.2')
    await setTsdk(dir.path, 'node_modules/typescript/lib')

    const resolved = resolveWorkspaceTypeScript(dir.path)
    expect(resolved.source).toBe('workspace')
    if (resolved.source !== 'workspace' || resolved.kind !== 'native-lsp')
      throw new Error('unreachable')
    expect(resolved.exe).toBeNull()
  })

  it('an absolute tsdk path is honored as-is', async () => {
    dir = await makeTmpDir('tsdk-absolute')
    const outside = await makeTmpDir('tsdk-absolute-pkg')
    try {
      await writeTsPackage(outside.path, 'typescript', '5.9.3', { 'lib/tsserver.js': '' })
      await setTsdk(dir.path, join(outside.path, 'typescript/lib'))

      const resolved = resolveWorkspaceTypeScript(dir.path)
      expect(resolved.source).toBe('workspace')
      if (resolved.source !== 'workspace') throw new Error('unreachable')
      expect(resolved.version).toBe('5.9.3')
    } finally {
      await outside.cleanup()
    }
  })
})
