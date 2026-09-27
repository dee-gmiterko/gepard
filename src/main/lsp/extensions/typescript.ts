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

// VS Code's settings.json is JSONC, which allows comments and trailing commas.
export function stripJsonComments(text: string): string {
  let out = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false
  let pendingComma = false
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
      if (pendingComma) {
        out += ','
        pendingComma = false
      }
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
      if (pendingComma) {
        out += ','
        pendingComma = false
      }
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
    if (c === ',') {
      pendingComma = true
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      out += c
      continue
    }
    if (pendingComma) {
      if (c !== '}' && c !== ']') out += ','
      pendingComma = false
    }
    out += c
  }
  return out
}

// VS Code honors `typescript.tsdk` only in a trusted workspace and otherwise
// uses its bundled TypeScript.
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

// VS Code's `typescript.tsdk` names a package's `lib` folder, relative to the
// workspace root unless absolute. Node's `require.resolve` caches resolutions.
export function resolveWorkspaceTypeScript(workspaceRoot: string): WorkspaceResolution {
  const tsdk = readTsdkSetting(workspaceRoot)
  if (!tsdk) return { source: 'bundled' }
  const tsdkDir = path.isAbsolute(tsdk) ? tsdk : path.join(workspaceRoot, tsdk)
  const pkgRoot = path.dirname(tsdkDir)
  const pkgJsonPath = path.join(pkgRoot, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) return { source: 'bundled' }
  let version: string
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { version?: unknown }
    if (typeof parsed.version !== 'string') return { source: 'bundled' }
    version = parsed.version
  } catch {
    return { source: 'bundled' }
  }
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
  // Electron cannot execute binaries from inside an asar archive.
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

export async function resolveLaunchPlan(
  root: string,
  trustWorkspaceToolchain = false
): Promise<LaunchPlan> {
  const resolved = trustWorkspaceToolchain
    ? resolveWorkspaceTypeScript(root)
    : ({ source: 'bundled' } as const)

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
    // typescript-language-server's default `useSyntaxServer: 'auto'` answers
    // semantic requests from a syntax-only server until the project loads.
    // `process.execPath` is the Electron binary, which runs as Node only with
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
  resolve(project: { root: string; trustWorkspaceToolchain?: boolean }): Promise<LaunchPlan> {
    return resolveLaunchPlan(project.root, project.trustWorkspaceToolchain === true)
  },
  start(plan: LaunchPlan, sink: ExtensionEvents) {
    return LspSession.start(plan, sink)
  }
}
