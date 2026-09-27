import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  LspSession,
  type ExtensionEvents,
  type LanguageExtension,
  type LaunchPlan
} from '../session'

const TS_EXTENSIONS = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/

type WorkspaceResolution =
  | { source: 'bundled' }
  | {
      source: 'workspace'
      version: string
      kind: 'native-lsp'
      exe: string | null
      lspArgs: string[]
    }
  | {
      source: 'workspace'
      version: string
      kind: 'js'
      jsApi: string | null
      tsserver: string | null
    }

/** Strips `//` and `/* *‍/` comments from VS Code's JSONC-flavored
 * `.vscode/settings.json` well enough for `JSON.parse`. Trailing commas are
 * not handled since only one known key is ever read here. */
export function stripJsonComments(text: string): string {
  let out = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false
        out += c
      }
      continue
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (inString) {
      out += c
      if (c === '\\') {
        if (next !== undefined) {
          out += next
          i++
        }
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (c === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    out += c
  }
  return out
}

/** Reads `typescript.tsdk` from `<workspaceRoot>/.vscode/settings.json` —
 * VS Code's own switch for using a workspace TypeScript instead of the
 * bundled one. Returns `null` when the setting is absent or invalid so
 * callers fall back to the bundled TypeScript, matching VS Code's default. */
export function readTsdkSetting(workspaceRoot: string): string | null {
  const settingsPath = path.join(workspaceRoot, '.vscode', 'settings.json')
  let raw: string
  try {
    raw = fs.readFileSync(settingsPath, 'utf8')
  } catch {
    return null
  }
  let json: unknown
  try {
    json = JSON.parse(stripJsonComments(raw))
  } catch {
    return null
  }
  if (!json || typeof json !== 'object') return null
  const tsdk = (json as Record<string, unknown>)['typescript.tsdk']
  return typeof tsdk === 'string' && tsdk.trim().length > 0 ? tsdk : null
}

/** `tsdk` is a folder path (VS Code's convention: `.../typescript/lib`)
 * relative to `workspaceRoot` unless absolute, with its package root one
 * directory up. This uses `fs.existsSync`/`readFileSync` instead of
 * `require.resolve`, since Node caches module resolution by realpath and
 * switching workspaces would keep returning a previously resolved
 * version. */
export function resolveWorkspaceTypeScript(workspaceRoot: string): WorkspaceResolution {
  const tsdk = readTsdkSetting(workspaceRoot)
  if (!tsdk) return { source: 'bundled' }
  const tsdkDir = path.isAbsolute(tsdk) ? tsdk : path.join(workspaceRoot, tsdk)
  const pkgRoot = path.dirname(tsdkDir)
  const pkgJsonPath = path.join(pkgRoot, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) return { source: 'bundled' }
  const { version } = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { version: string }
  if (Number(version.split('.')[0]) >= 7) {
    const platformPkg = `@typescript/typescript-${process.platform}-${process.arch}`
    const exe = path.join(
      path.dirname(pkgRoot),
      platformPkg,
      'lib',
      process.platform === 'win32' ? 'tsc.exe' : 'tsc'
    )
    return {
      source: 'workspace',
      version,
      kind: 'native-lsp',
      exe: fs.existsSync(exe) ? exe : null,
      lspArgs: ['--lsp', '--stdio']
    }
  }
  const jsApi = path.join(pkgRoot, 'lib/typescript.js')
  const tsserver = path.join(pkgRoot, 'lib/tsserver.js')
  return {
    source: 'workspace',
    version,
    kind: 'js',
    jsApi: fs.existsSync(jsApi) ? jsApi : null,
    tsserver: fs.existsSync(tsserver) ? tsserver : null
  }
}

/** This app's own bundled `@typescript/typescript-<platform>-<arch>` native
 * binary — a fixed dependency, not the workspace's, so `require.resolve`'s
 * realpath-based caching (see `resolveWorkspaceTypeScript` above) is not a
 * problem here. */
function bundledNativeExe(): string {
  const platformPkg = `@typescript/typescript-${process.platform}-${process.arch}`
  let pkgJsonPath: string
  try {
    pkgJsonPath = require.resolve(`${platformPkg}/package.json`)
  } catch (e) {
    throw new Error(
      `Bundled TypeScript native binary not found (${platformPkg} is not installed). ` +
        `Add it as a dependency in package.json. (${(e as Error).message})`
    )
  }
  const exe = path.join(
    path.dirname(pkgJsonPath),
    'lib',
    process.platform === 'win32' ? 'tsc.exe' : 'tsc'
  )
  // Electron's asar packaging cannot execute binaries from inside the
  // archive, so a path under app.asar is rewritten to its unpacked copy.
  return exe.includes('app.asar') ? exe.replace('app.asar', 'app.asar.unpacked') : exe
}

function bundledTypescriptLanguageServerBin(): string {
  let pkgJsonPath: string
  try {
    pkgJsonPath = require.resolve('typescript-language-server/package.json')
  } catch (e) {
    throw new Error(
      'typescript-language-server is not bundled with this app; add it as a dependency to support ' +
        `a workspace TypeScript 5.x toolchain. (${(e as Error).message})`
    )
  }
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
    bin?: Record<string, string> | string
  }
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['typescript-language-server']
  if (!binRel) throw new Error('typescript-language-server package has no bin entry')
  return path.join(path.dirname(pkgJsonPath), binRel)
}

async function resolveLaunchPlan(root: string): Promise<LaunchPlan> {
  const resolved = resolveWorkspaceTypeScript(root)

  if (resolved.source === 'workspace' && resolved.kind === 'native-lsp' && resolved.exe) {
    return {
      command: resolved.exe,
      args: resolved.lspArgs,
      cwd: root,
      source: 'workspace',
      version: resolved.version
    }
  }

  if (resolved.source === 'workspace' && resolved.kind === 'js' && resolved.tsserver) {
    // typescript-language-server's default useSyntaxServer ('auto') answers
    // semantic requests from its syntax-only server before the project has
    // loaded, so it must be set to 'never'. Automatic typings acquisition
    // must also be disabled, since it reaches out to the network and spawns
    // a third process.
    // typescript-language-server is pure JS meant to run under Node, but a
    // packaged Electron app has no system `node`: `process.execPath` in the
    // main process is Electron's own binary, so it must be run with
    // `ELECTRON_RUN_AS_NODE=1`.
    const tls = bundledTypescriptLanguageServerBin()
    return {
      command: process.execPath,
      args: [tls, '--stdio'],
      cwd: root,
      env: { ELECTRON_RUN_AS_NODE: '1' },
      source: 'workspace',
      version: resolved.version,
      initializationOptions: {
        tsserver: { path: resolved.tsserver, useSyntaxServer: 'never' },
        disableAutomaticTypingAcquisition: true
      }
    }
  }

  return {
    command: bundledNativeExe(),
    args: ['--lsp', '--stdio'],
    cwd: root,
    source: 'bundled'
  }
}

export const typescriptExtension: LanguageExtension = {
  id: 'typescript',
  displayName: 'TypeScript',
  matches(filePath: string): boolean {
    return TS_EXTENSIONS.test(filePath)
  },
  resolve(project: { root: string }): Promise<LaunchPlan> {
    return resolveLaunchPlan(project.root)
  },
  start(plan: LaunchPlan, sink: ExtensionEvents) {
    return LspSession.start(plan, sink)
  }
}
