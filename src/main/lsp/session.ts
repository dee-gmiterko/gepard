// Generic LspSession over vscode-jsonrpc (report 03 §4): implements
// LanguageSession for any LanguageExtension's LaunchPlan. A future extension
// for another language only needs a LaunchPlan + matches(); this file never
// mentions TypeScript.
//
// Client-side obligations implemented here (report 03 §4 design notes,
// verified against a real `tsc --lsp --stdio` in the scratchpad spike):
//  - window/workDoneProgress/create, client/registerCapability /
//    unregisterCapability all answered with `null` (accept-everything).
//  - workspace/configuration answered with one `{}` per requested item.
//  - semanticTokens.tokenTypes/tokenModifiers declared in client capabilities
//    (the standard LSP 3.17 lists) or the server returns an empty legend.
//  - general.positionEncodings: ['utf-16'] negotiated explicitly.
//  - Only the documents being queried are opened (didOpen with file text,
//    didClose right after), serialized per absolute path so concurrent
//    queries on the same file cannot interleave open/close pairs.
//  - The child process is kept alive for the project's lifetime; on an
//    unexpected exit the session transparently relaunches once.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as path from 'node:path'
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type CancellationToken,
  type MessageConnection
} from 'vscode-jsonrpc/node'
import { CrashGate } from './crash-gate'
import {
  FileMatches as FileMatchesSchema,
  Match as MatchSchema,
  WorkspaceSymbol as WorkspaceSymbolSchema,
  Pos as PosSchema,
  Range as RangeSchema,
  SymbolKind as SymbolKindSchema
} from '@shared/ipc/schemas/search'
import {
  DefinitionTarget as DefinitionTargetSchema,
  LineSymbol as LineSymbolSchema
} from '@shared/ipc/schemas/index'
import type { IndexStatus } from '@shared/ipc/schemas/index'

export type LineSymbol = ReturnType<typeof LineSymbolSchema.parse>
export type FileMatches = ReturnType<typeof FileMatchesSchema.parse>
export type Match = ReturnType<typeof MatchSchema.parse>
export type WorkspaceSymbol = ReturnType<typeof WorkspaceSymbolSchema.parse>
export type Pos = ReturnType<typeof PosSchema.parse>
export type Range = ReturnType<typeof RangeSchema.parse>
export type SymbolKind = ReturnType<typeof SymbolKindSchema.parse>
export type DefinitionTarget = ReturnType<typeof DefinitionTargetSchema.parse>

/** How to launch one language server for one project (report 03 §4). */
export interface LaunchPlan {
  command: string
  args: string[]
  cwd: string
  /** Extra/overriding environment for the child process (e.g.
   * `ELECTRON_RUN_AS_NODE: '1'` when `command` is Electron's own binary
   * standing in for a system `node`, report 03 §5.3); merged over
   * `process.env`. */
  env?: NodeJS.ProcessEnv
  initializationOptions?: unknown
  source: 'workspace' | 'bundled'
  version?: string
}

export interface ExtensionEvents {
  status(s: IndexStatus): void
  log(level: 'info' | 'warn' | 'error', msg: string): void
}

/** One "LSP extension" (report 03 §2-4). */
export interface LanguageExtension {
  id: string
  displayName: string
  /** which files this extension owns (drives the "Symbol definition" checkbox visibility) */
  matches(filePath: string): boolean
  /** decide how to launch: workspace toolchain vs bundled; cheap, side-effect free */
  resolve(project: { root: string }): Promise<LaunchPlan>
  start(plan: LaunchPlan, sink: ExtensionEvents): Promise<LanguageSession>
}

/** One path changed by a checkout, in the LSP FileChangeType vocabulary. */
export interface FileChange {
  path: string
  type: 'created' | 'changed' | 'deleted'
}

export interface LanguageSession {
  /** semanticTokens/range → tokens on that line. `token`, when given, is
   * forwarded to the LSP request so a superseded caller can cancel it
   * (`$/cancelRequest`, coordinator cancellation spec). */
  lineSymbols(filePath: string, line: number, token?: CancellationToken): Promise<LineSymbol[]>
  /** textDocument/definition */
  definition(filePath: string, pos: Pos, token?: CancellationToken): Promise<DefinitionTarget[]>
  /** textDocument/references, grouped per file */
  references(filePath: string, pos: Pos, token?: CancellationToken): Promise<FileMatches[]>
  /** workspace/symbol (fuzzy prefill) */
  workspaceSymbols(
    query: string,
    limit: number,
    token?: CancellationToken
  ): Promise<WorkspaceSymbol[]>
  /** after checkout → didChangeWatchedFiles */
  filesChanged(changes: FileChange[]): void
  dispose(): Promise<void>
}

// Standard LSP 3.17 semantic token legend the client declares support for;
// servers otherwise report an empty legend (report 03 §4).
const STANDARD_TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'event',
  'function',
  'method',
  'macro',
  'keyword',
  'modifier',
  'comment',
  'string',
  'number',
  'regexp',
  'operator',
  'decorator'
]
const STANDARD_TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary'
]
const KNOWN_MODIFIERS = new Set([
  'declaration',
  'readonly',
  'static',
  'async',
  'local',
  'defaultLibrary'
])

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function languageIdFor(filePath: string): string {
  if (filePath.endsWith('.tsx')) return 'typescriptreact'
  if (filePath.endsWith('.jsx')) return 'javascriptreact'
  if (filePath.endsWith('.mjs') || filePath.endsWith('.cjs') || filePath.endsWith('.js'))
    return 'javascript'
  return 'typescript' // .ts, .mts, .cts, .d.ts
}

function mapSemanticTokenType(type: string | undefined, readonly: boolean): SymbolKind {
  switch (type) {
    case 'namespace':
      return 'namespace'
    case 'class':
      return 'class'
    case 'interface':
      return 'interface'
    case 'enum':
      return 'enum'
    case 'enumMember':
      return 'enumMember'
    case 'type':
    case 'struct':
      return 'type'
    case 'typeParameter':
      return 'typeParameter'
    case 'function':
      return 'function'
    case 'method':
      return 'method'
    case 'property':
      return 'property'
    case 'parameter':
      return 'parameter'
    case 'variable':
      return readonly ? 'constant' : 'variable'
    default:
      return 'unknown'
  }
}

// LSP 3.17 numeric SymbolKind (workspace/symbol, documentSymbol) -> our enum.
function mapLspSymbolKind(k: number): SymbolKind {
  switch (k) {
    case 3:
      return 'namespace'
    case 5:
      return 'class'
    case 11:
      return 'interface'
    case 10:
      return 'enum'
    case 22:
      return 'enumMember'
    case 26:
      return 'typeParameter'
    case 12:
      return 'function'
    case 6:
    case 9:
      return 'method'
    case 7:
    case 8:
      return 'property'
    case 13:
      return 'variable'
    case 14:
      return 'constant'
    default:
      return 'unknown'
  }
}

interface LspPosition {
  line: number
  character: number
}
interface LspRange {
  start: LspPosition
  end: LspPosition
}
interface LspLocation {
  uri: string
  range: LspRange
}
/** textDocument/definition may reply with plain Locations or LocationLinks. */
interface LspLocationLink {
  targetUri: string
  targetSelectionRange: LspRange
  targetRange: LspRange
}

function toRange(r: LspRange): Range {
  return {
    start: { line: r.start.line + 1, col: r.start.character + 1 },
    end: { line: r.end.line + 1, col: r.end.character + 1 }
  }
}

/** Generic LSP client over vscode-jsonrpc for any LaunchPlan (report 03 §4). */
export class LspSession implements LanguageSession {
  private conn!: MessageConnection
  private child!: ChildProcessWithoutNullStreams
  private legend: { tokenTypes: string[]; tokenModifiers: string[] } = {
    tokenTypes: [],
    tokenModifiers: []
  }
  private docQueue = new Map<string, Promise<unknown>>()
  private disposed = false
  private restarting = false
  // Per-incarnation crash bookkeeping (crash-gate.ts): rejects requests still
  // in flight when this incarnation crashes, and dedupes the crash's own
  // log/toast when both 'error' and 'exit' fire for it. Reset at the top of
  // every `launch()`, including a restart's relaunch.
  private crashGate = new CrashGate()

  private constructor(
    private readonly plan: LaunchPlan,
    private readonly sink: ExtensionEvents
  ) {}

  static async start(plan: LaunchPlan, sink: ExtensionEvents): Promise<LspSession> {
    const session = new LspSession(plan, sink)
    await session.launch()
    return session
  }

  private async launch(): Promise<void> {
    // Fresh per incarnation: a restart must not carry over the previous
    // incarnation's already-rejected requests or "already logged" flag.
    this.crashGate.reset()

    const child = spawn(this.plan.command, this.plan.args, {
      cwd: this.plan.cwd,
      env: this.plan.env ? { ...process.env, ...this.plan.env } : process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child
    child.stderr.on('data', (d: Buffer) => this.sink.log('warn', d.toString('utf8').trim()))
    // While launching, a process error (e.g. spawn ENOENT) or exit fails this
    // launch() instead of being reported through the sink: its caller (the
    // first start -> lsp/index.ts 'error' status, or handleExit's restart ->
    // 'LSP restart failed') already logs and surfaces the rejection, so
    // reporting it here too would log and toast one failure twice. It also
    // keeps a server that dies mid-`initialize` from hanging launch()
    // forever (vscode-jsonrpc does not reject pending requests on close).
    let failLaunch: ((e: Error) => void) | null = null
    // Set once this launch has failed: the process it kills below is then
    // already accounted for, so its exit is neither reported nor restarted.
    let abandoned = false
    const launchFailed = new Promise<never>((_, reject) => {
      failLaunch = reject
    })
    child.once('error', (err) => {
      if (abandoned) return
      const message = `LSP process error: ${err.message}`
      if (failLaunch) failLaunch(new Error(message))
      // A running server's 'error' and 'exit' events are not mutually
      // exclusive (Node does not guarantee only one fires for a given
      // failure): the crash gate makes sure this crash is still toasted only
      // once, whichever of this handler and `handleExit`'s 'exit' branch runs
      // first (or both).
      else if (this.crashGate.crash()) {
        this.sink.log('error', message)
      }
    })
    child.once('exit', (code, signal) => {
      if (abandoned) return
      if (failLaunch)
        failLaunch(new Error(`LSP process exited during startup (code=${code}, signal=${signal})`))
      else this.handleExit(code, signal)
    })

    const conn = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin)
    )
    this.conn = conn
    this.wireClientObligations(conn)
    conn.listen()

    try {
      const initResult = (await Promise.race([
        conn.sendRequest('initialize', this.initializeParams()),
        launchFailed
      ])) as {
        capabilities?: {
          semanticTokensProvider?: { legend?: { tokenTypes: string[]; tokenModifiers: string[] } }
        }
      }
      this.legend = initResult.capabilities?.semanticTokensProvider?.legend ?? {
        tokenTypes: [],
        tokenModifiers: []
      }
      await Promise.race([conn.sendNotification('initialized', {}), launchFailed])
    } catch (e) {
      abandoned = true
      conn.dispose()
      if (child.exitCode === null && child.signalCode === null) child.kill()
      throw e
    } finally {
      failLaunch = null
    }
  }

  private initializeParams(): unknown {
    const rootUri = pathToFileURL(this.plan.cwd).toString()
    return {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: path.basename(this.plan.cwd) }],
      initializationOptions: this.plan.initializationOptions,
      capabilities: {
        general: { positionEncodings: ['utf-16'] },
        workspace: {
          configuration: true,
          workspaceFolders: true,
          didChangeWatchedFiles: { dynamicRegistration: true },
          didChangeConfiguration: { dynamicRegistration: true },
          symbol: {}
        },
        window: { workDoneProgress: true },
        textDocument: {
          synchronization: { dynamicRegistration: false },
          definition: { linkSupport: false },
          references: {},
          semanticTokens: {
            requests: { range: true, full: false },
            tokenTypes: STANDARD_TOKEN_TYPES,
            tokenModifiers: STANDARD_TOKEN_MODIFIERS,
            formats: ['relative']
          }
        }
      }
    }
  }

  private wireClientObligations(conn: MessageConnection): void {
    conn.onRequest('window/workDoneProgress/create', () => null)
    conn.onRequest('client/registerCapability', () => null)
    conn.onRequest('client/unregisterCapability', () => null)
    conn.onRequest('workspace/configuration', (params: { items?: unknown[] }) =>
      (params?.items ?? []).map(() => ({}))
    )
    conn.onNotification('window/logMessage', (p: { message: string }) =>
      this.sink.log('info', p.message)
    )
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.disposed) return
    // Whatever was waiting on this incarnation's connection would otherwise
    // hang forever — vscode-jsonrpc never rejects pending requests on its own
    // when the underlying stream closes — so reject them now: their queries
    // fail and report normally (as a CANCELLED-shaped result the renderer
    // does not toast, since the crash itself is toasted at most once, below).
    // See the 'error' handler above: this crash may already have been
    // toasted from there — `crash()` reports true at most once per incarnation.
    if (this.crashGate.crash()) {
      this.sink.log('error', `LSP process exited unexpectedly (code=${code}, signal=${signal})`)
    }
    if (this.restarting) return
    this.restarting = true
    this.launch().then(
      () => {
        this.restarting = false
        // 'warn' (not 'info'): the sink drops 'info' as too chatty, but a
        // restart is a notable crash-recovery event worth keeping in the log.
        this.sink.log('warn', 'LSP process restarted')
      },
      (e: Error) => {
        // A dispose() while restarting kills the new process on purpose.
        if (!this.disposed) this.sink.log('error', `LSP restart failed: ${e.message}`)
      }
    )
  }

  /** Resolves an LSP location to a repo-relative path when inside the
   * project, or a sanitized absolute-path-derived string (still a valid
   * RepoPath, never referenceable) when outside it (report 03 §7:
   * DefinitionTarget.external). */
  private toRepoLocation(uri: string): { path: string; external: boolean } {
    const abs = fileURLToPath(uri)
    const rel = path.relative(this.plan.cwd, abs)
    const isInside = rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel)
    if (isInside) return { path: toPosix(rel), external: false }
    const stripped = toPosix(abs).replace(/^\/+/, '')
    return { path: stripped.length > 0 ? stripped : 'external', external: true }
  }

  private absPath(repoRelativePath: string): string {
    return path.join(this.plan.cwd, repoRelativePath)
  }

  /** `MessageConnection#sendRequest`'s string overload treats an explicit
   * `undefined` third argument as a second params element, not "no
   * cancellation token" (it only special-cases an actual `CancellationToken`
   * there) — so `token` is appended only when given. Guarded by the crash
   * gate so a request in flight when the server crashes rejects right away
   * instead of hanging forever (`handleExit`/the 'error' handler). */
  private sendRequest<R>(method: string, params: unknown, token?: CancellationToken): Promise<R> {
    const real = (
      token ? this.conn.sendRequest(method, params, token) : this.conn.sendRequest(method, params)
    ) as Promise<R>
    return this.crashGate.guard(real)
  }

  /** Opens `absPath` (didOpen with file text), runs `fn`, then didCloses.
   * Serialized per path so concurrent queries on the same document cannot
   * interleave open/close notifications (report 03 §4). */
  private withOpenDocument<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    const previous = this.docQueue.get(filePath) ?? Promise.resolve()
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const text = await readFile(filePath, 'utf8')
        const uri = pathToFileURL(filePath).toString()
        await this.conn.sendNotification('textDocument/didOpen', {
          textDocument: { uri, languageId: languageIdFor(filePath), version: 1, text }
        })
        try {
          return await fn(text)
        } finally {
          await this.conn.sendNotification('textDocument/didClose', { textDocument: { uri } })
        }
      })
    this.docQueue.set(
      filePath,
      run.then(
        () => undefined,
        () => undefined
      )
    )
    return run
  }

  async lineSymbols(
    filePath: string,
    line: number,
    token?: CancellationToken
  ): Promise<LineSymbol[]> {
    const abs = this.absPath(filePath)
    return this.withOpenDocument(abs, async (text) => {
      const uri = pathToFileURL(abs).toString()
      const lineIdx0 = line - 1
      const lineText = text.split('\n')[lineIdx0] ?? ''
      const result = await this.sendRequest<{ data: number[] } | null>(
        'textDocument/semanticTokens/range',
        {
          textDocument: { uri },
          range: {
            start: { line: lineIdx0, character: 0 },
            end: { line: lineIdx0, character: lineText.length }
          }
        },
        token
      )
      if (!result?.data?.length) return []

      const out: LineSymbol[] = []
      let curLine = 0
      let curChar = 0
      for (let i = 0; i < result.data.length; i += 5) {
        const deltaLine = result.data[i]
        const deltaChar = result.data[i + 1]
        const length = result.data[i + 2]
        const typeIdx = result.data[i + 3]
        const modBits = result.data[i + 4]
        curLine += deltaLine
        curChar = deltaLine === 0 ? curChar + deltaChar : deltaChar
        if (curLine !== lineIdx0) continue
        const modifiers = this.legend.tokenModifiers.filter((_, bi) => (modBits & (1 << bi)) !== 0)
        out.push({
          name: lineText.slice(curChar, curChar + length),
          kind: mapSemanticTokenType(
            this.legend.tokenTypes[typeIdx],
            modifiers.includes('readonly')
          ),
          modifiers: modifiers.filter((m) => KNOWN_MODIFIERS.has(m)) as LineSymbol['modifiers'],
          range: { start: { line, col: curChar + 1 }, end: { line, col: curChar + length + 1 } }
        })
      }
      return out
    })
  }

  async definition(
    filePath: string,
    pos: Pos,
    token?: CancellationToken
  ): Promise<DefinitionTarget[]> {
    const abs = this.absPath(filePath)
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString()
      const raw = await this.sendRequest<
        LspLocation | LspLocationLink | (LspLocation | LspLocationLink)[] | null
      >(
        'textDocument/definition',
        {
          textDocument: { uri },
          position: { line: pos.line - 1, character: pos.col - 1 }
        },
        token
      )

      const list = Array.isArray(raw) ? raw : raw ? [raw] : []
      return list.map((item): DefinitionTarget => {
        const isLink = 'targetUri' in item
        const uriStr = isLink ? item.targetUri : item.uri
        const range = isLink ? (item.targetSelectionRange ?? item.targetRange) : item.range
        const { path: repoPath, external } = this.toRepoLocation(uriStr)
        return { location: { path: repoPath, range: toRange(range) }, external }
      })
    })
  }

  async references(filePath: string, pos: Pos, token?: CancellationToken): Promise<FileMatches[]> {
    const abs = this.absPath(filePath)
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString()
      const raw = await this.sendRequest<LspLocation[] | null>(
        'textDocument/references',
        {
          textDocument: { uri },
          position: { line: pos.line - 1, character: pos.col - 1 },
          context: { includeDeclaration: true }
        },
        token
      )

      const byFile = new Map<string, Match[]>()
      const textCache = new Map<string, string[]>()
      for (const loc of raw ?? []) {
        const { path: repoPath, external } = this.toRepoLocation(loc.uri)
        if (external) continue
        const targetAbs = fileURLToPath(loc.uri)
        let lines = textCache.get(targetAbs)
        if (!lines) {
          lines = await readFile(targetAbs, 'utf8')
            .then((t) => t.split('\n'))
            .catch(() => [] as string[])
          textCache.set(targetAbs, lines)
        }
        const lineText = lines[loc.range.start.line] ?? ''
        const matches = byFile.get(repoPath) ?? []
        matches.push({
          line: loc.range.start.line + 1,
          preview: lineText.replace(/\r?$/, ''),
          spans: [[loc.range.start.character, loc.range.end.character]]
        })
        byFile.set(repoPath, matches)
      }
      return Array.from(byFile.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([repoPath, matches]) => ({
          path: repoPath,
          targeted: false, // overlaid by the caller, which knows the current targeting
          matches: matches.sort((a, b) => a.line - b.line)
        }))
    })
  }

  async workspaceSymbols(
    query: string,
    limit: number,
    token?: CancellationToken
  ): Promise<WorkspaceSymbol[]> {
    const raw = await this.sendRequest<Array<{
      name: string
      kind: number
      containerName?: string
      location: LspLocation
    }> | null>('workspace/symbol', { query }, token)
    const out: WorkspaceSymbol[] = []
    for (const s of raw ?? []) {
      const { path: repoPath, external } = this.toRepoLocation(s.location.uri)
      if (external) continue
      out.push({
        name: s.name,
        kind: mapLspSymbolKind(s.kind),
        containerName: s.containerName,
        location: { path: repoPath, range: toRange(s.location.range) }
      })
      if (out.length >= limit) break
    }
    return out
  }

  filesChanged(changes: FileChange[]): void {
    if (changes.length === 0) return
    const typeOf = { created: 1, changed: 2, deleted: 3 } as const
    this.conn
      .sendNotification('workspace/didChangeWatchedFiles', {
        changes: changes.map((c) => ({
          uri: pathToFileURL(this.absPath(c.path)).toString(),
          type: typeOf[c.type]
        }))
      })
      .catch((e: Error) => this.sink.log('warn', `didChangeWatchedFiles failed: ${e.message}`))
  }

  async dispose(): Promise<void> {
    this.disposed = true
    try {
      await this.conn.sendRequest('shutdown')
      await this.conn.sendNotification('exit')
    } catch {
      // best effort; fall through to killing the process
    }
    this.conn.dispose()
    if (!this.child.killed) this.child.kill()
  }
}
