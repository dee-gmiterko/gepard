// The TypeScript LanguageExtension (report 03 §2-4): resolves a workspace
// TypeScript toolchain the same way VS Code's tsdk resolution does, or falls
// back to the bundled TypeScript 7 native binary, and starts a generic
// LspSession over the result.
//
// Three launch strategies (report 03 §3), chosen by `resolveWorkspaceTypeScript`
// (verbatim from the report — do NOT switch this to `require.resolve`: Node
// caches module resolution by realpath, so switching projects would keep
// returning a previously-resolved workspace version):
//   (a) workspace `node_modules/typescript` >= 7  -> spawn the workspace's own
//       `node_modules/@typescript/typescript-<platform>-<arch>/lib/tsc --lsp --stdio`
//   (b) workspace TypeScript 5.x -> spawn the bundled `typescript-language-server`
//       with `initializationOptions.tsserver.path` pointing at the workspace's
//       `lib/tsserver.js`
//   (c) nothing usable in the workspace -> bundled TypeScript 7 native binary
//       (this app's own `@typescript/typescript-<platform>-<arch>` dependency).
// Since the app never installs dependencies in its clones, (c) is the common
// path (report 03 §1, §8).
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

/** Verified resolver, report 03 §3: workspace `node_modules/typescript` ->
 * bundled. Uses `fs.existsSync`/`readFileSync`, never `require.resolve`. */
function resolveWorkspaceTypeScript(workspaceRoot: string): WorkspaceResolution {
  const pkgJsonPath = path.join(workspaceRoot, 'node_modules/typescript/package.json')
  if (!fs.existsSync(pkgJsonPath)) return { source: 'bundled' }
  const dir = path.dirname(pkgJsonPath)
  const { version } = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { version: string }
  if (Number(version.split('.')[0]) >= 7) {
    const platformPkg = `@typescript/typescript-${process.platform}-${process.arch}`
    const exe = path.join(
      workspaceRoot,
      'node_modules',
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
  const jsApi = path.join(dir, 'lib/typescript.js')
  const tsserver = path.join(dir, 'lib/tsserver.js')
  return {
    source: 'workspace',
    version,
    kind: 'js',
    jsApi: fs.existsSync(jsApi) ? jsApi : null,
    tsserver: fs.existsSync(tsserver) ? tsserver : null
  }
}

/** This app's own bundled TS 7 native binary (`@typescript/typescript-<platform>-<arch>`,
 * a fixed dependency of this app, not the workspace's — `require.resolve` is
 * safe here, unlike for the workspace's own TypeScript above). */
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
  // Binaries cannot execute from inside an asar (report 03 §5.3/§8).
  return exe.includes('app.asar') ? exe.replace('app.asar', 'app.asar.unpacked') : exe
}

/** This app's own bundled `typescript-language-server` (strategy (b)'s
 * client), resolved the same way as the native binary above. */
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
    // (a) workspace TypeScript 7 native binary.
    return {
      command: resolved.exe,
      args: resolved.lspArgs,
      cwd: root,
      source: 'workspace',
      version: resolved.version
    }
  }

  if (resolved.source === 'workspace' && resolved.kind === 'js' && resolved.tsserver) {
    // (b) workspace TypeScript 5.x -> bundled typescript-language-server,
    // pointed at the workspace's own tsserver.js. Report 03 §2.1 pitfalls:
    // useSyntaxServer must be 'never' (default 'auto' answers semantic
    // requests from the syntax-only server before the project loads) and
    // automatic typings acquisition must be disabled (it tries to hit the
    // network and starts a third process). `typescript-language-server` is
    // pure JS spawned with Node, but there is no system `node` in a packaged
    // app: `process.execPath` inside Electron's main process is Electron's
    // own binary, so it must run with `ELECTRON_RUN_AS_NODE=1` (report 03 §5.3).
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

  // (c) bundled fallback: this app's own TypeScript 7 native binary. The
  // common path — the app never installs dependencies in its clones.
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
