import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import { unpackPayload } from './payload.js';
import { CrashGate } from './crash-gate.js';
import { toPosix, comparePaths } from './paths.js';
import type {
  DefinitionTarget,
  DocumentSymbol,
  ExtensionEvents,
  ExtensionHost,
  FileChange,
  FileMatches,
  LanguageSession,
  LineSymbol,
  Match,
  Pos,
  Range,
  SymbolKind,
  WorkspaceSymbol,
} from './types.js';

const JAVA_EXTENSIONS = /\.java$/;

const VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor');

function languageId(): string {
  return 'java';
}

function configDirName(): string {
  if (process.platform === 'darwin') return 'config_mac';
  if (process.platform === 'win32') return 'config_win';
  return 'config_linux';
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function launcherJar(pluginsDir: string): Promise<string> {
  const name = (await readdir(pluginsDir)).find((f) =>
    f.startsWith('org.eclipse.equinox.launcher_'),
  );
  if (!name) throw new Error(`equinox launcher jar not found in ${pluginsDir}`);
  return path.join(pluginsDir, name);
}

async function materialize(dataDir: string): Promise<{ launcher: string; dir: string }> {
  let version: string;
  try {
    version = (await readFile(path.join(VENDOR_DIR, 'version.txt'), 'utf8')).trim();
  } catch (e) {
    throw new Error(
      `Bundled Eclipse JDT Language Server payload not found; run the extension's vendor step (${(e as Error).message})`,
    );
  }
  const dir = path.join(dataDir, version);
  const pluginsDir = path.join(dir, 'plugins');
  if (await exists(pluginsDir)) {
    return { launcher: await launcherJar(pluginsDir), dir };
  }

  await mkdir(dataDir, { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  await unpackPayload(await readFile(path.join(VENDOR_DIR, 'payload.bin')), tmp);
  try {
    await rename(tmp, dir);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    if (!(await exists(pluginsDir))) throw e;
  }
  return { launcher: await launcherJar(pluginsDir), dir };
}

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
  'decorator',
];
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
  'defaultLibrary',
];
const KNOWN_MODIFIERS = new Set(['declaration', 'readonly', 'static', 'async', 'defaultLibrary']);

function mapSemanticTokenType(type: string | undefined, readonly: boolean): SymbolKind {
  switch (type) {
    case 'namespace':
      return 'namespace';
    case 'class':
      return 'class';
    case 'interface':
      return 'interface';
    case 'enum':
      return 'enum';
    case 'enumMember':
      return 'enumMember';
    case 'type':
    case 'struct':
      return 'type';
    case 'typeParameter':
      return 'typeParameter';
    case 'function':
      return 'function';
    case 'method':
      return 'method';
    case 'property':
      return 'property';
    case 'parameter':
      return 'parameter';
    case 'variable':
      return readonly ? 'constant' : 'variable';
    default:
      return 'unknown';
  }
}

function mapLspSymbolKind(k: number): SymbolKind {
  switch (k) {
    case 2:
    case 3:
    case 4:
      return 'namespace';
    case 5:
      return 'class';
    case 11:
      return 'interface';
    case 10:
      return 'enum';
    case 22:
      return 'enumMember';
    case 26:
      return 'typeParameter';
    case 12:
      return 'function';
    case 6:
    case 9:
      return 'method';
    case 7:
    case 8:
      return 'property';
    case 13:
      return 'variable';
    case 14:
      return 'constant';
    default:
      return 'unknown';
  }
}

interface LspPosition {
  line: number;
  character: number;
}
interface LspRange {
  start: LspPosition;
  end: LspPosition;
}
interface LspLocation {
  uri: string;
  range: LspRange;
}
interface LspLocationLink {
  targetUri: string;
  targetSelectionRange: LspRange;
  targetRange: LspRange;
}

function toRange(r: LspRange): Range {
  return {
    start: { line: r.start.line + 1, col: r.start.character + 1 },
    end: { line: r.end.line + 1, col: r.end.character + 1 },
  };
}

interface LspDocumentSymbol {
  name: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
}
interface LspSymbolInformation {
  name: string;
  kind: number;
  location: LspLocation;
  containerName?: string;
}

function isDocumentSymbolArray(
  raw: LspDocumentSymbol[] | LspSymbolInformation[],
): raw is LspDocumentSymbol[] {
  return raw.length === 0 || 'range' in raw[0];
}

function toDocumentSymbol(s: LspDocumentSymbol): DocumentSymbol {
  return {
    name: s.name,
    kind: mapLspSymbolKind(s.kind),
    range: toRange(s.range),
    selectionRange: toRange(s.selectionRange),
    children: (s.children ?? []).map(toDocumentSymbol),
  };
}

function flatSymbolsToTree(raw: LspSymbolInformation[]): DocumentSymbol[] {
  const nodes = raw.map((s): DocumentSymbol => ({
    name: s.name,
    kind: mapLspSymbolKind(s.kind),
    range: toRange(s.location.range),
    selectionRange: toRange(s.location.range),
    children: [],
  }));
  const byName = new Map<string, DocumentSymbol[]>();
  for (let i = 0; i < raw.length; i++) {
    const list = byName.get(raw[i].name) ?? [];
    list.push(nodes[i]);
    byName.set(raw[i].name, list);
  }
  const roots: DocumentSymbol[] = [];
  for (let i = 0; i < raw.length; i++) {
    const containerName = raw[i].containerName;
    const parentCandidates = containerName ? byName.get(containerName) : undefined;
    const parent = parentCandidates?.find((p) => p !== nodes[i]);
    if (parent) parent.children.push(nodes[i]);
    else roots.push(nodes[i]);
  }
  return roots;
}

interface LaunchPlan {
  command: string;
  args: string[];
  cwd: string;
}

class JdtlsSession implements LanguageSession {
  private conn!: MessageConnection;
  private child!: ChildProcessWithoutNullStreams;
  private legend: { tokenTypes: string[]; tokenModifiers: string[] } = {
    tokenTypes: [],
    tokenModifiers: [],
  };
  private docQueue = new Map<string, Promise<unknown>>();
  private disposed = false;
  private restarting = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempts = 0;
  private restartWindowStart = 0;
  private static readonly MAX_RESTARTS_PER_WINDOW = 5;
  private static readonly RESTART_WINDOW_MS = 60_000;
  private static readonly RESTART_BASE_DELAY_MS = 500;
  private static readonly RESTART_MAX_DELAY_MS = 30_000;
  private static readonly DISPOSE_TIMEOUT_MS = 3_000;
  private crashGate = new CrashGate();

  private constructor(
    private readonly plan: LaunchPlan,
    private readonly sink: ExtensionEvents,
  ) {}

  static async start(plan: LaunchPlan, sink: ExtensionEvents): Promise<JdtlsSession> {
    const session = new JdtlsSession(plan, sink);
    await session.launch();
    return session;
  }

  private async launch(): Promise<void> {
    this.crashGate.reset();

    const child = spawn(this.plan.command, this.plan.args, {
      cwd: this.plan.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    child.stderr.on('data', (d: Buffer) => this.sink.log('warn', d.toString('utf8').trim()));
    let failLaunch: ((e: Error) => void) | null = null;
    let abandoned = false;
    const launchFailed = new Promise<never>((_, reject) => {
      failLaunch = reject;
    });
    child.once('error', (err) => {
      if (abandoned) return;
      const message = `LSP process error: ${err.message}`;
      if (failLaunch) failLaunch(new Error(message));
      else if (this.crashGate.crash()) {
        this.sink.log('error', message);
      }
    });
    child.once('exit', (code, signal) => {
      if (abandoned) return;
      if (failLaunch)
        failLaunch(new Error(`LSP process exited during startup (code=${code}, signal=${signal})`));
      else this.handleExit(code, signal);
    });

    const conn = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin),
    );
    this.conn = conn;
    this.wireClientObligations(conn);
    conn.listen();

    try {
      const initResult = (await Promise.race([
        conn.sendRequest('initialize', this.initializeParams()),
        launchFailed,
      ])) as {
        capabilities?: {
          semanticTokensProvider?: { legend?: { tokenTypes: string[]; tokenModifiers: string[] } };
        };
      };
      this.legend = initResult.capabilities?.semanticTokensProvider?.legend ?? {
        tokenTypes: [],
        tokenModifiers: [],
      };
      await Promise.race([conn.sendNotification('initialized', {}), launchFailed]);
    } catch (e) {
      abandoned = true;
      conn.dispose();
      if (child.exitCode === null && child.signalCode === null) child.kill();
      throw e;
    } finally {
      failLaunch = null;
    }
  }

  private initializeParams(): unknown {
    const rootUri = pathToFileURL(this.plan.cwd).toString();
    return {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: path.basename(this.plan.cwd) }],
      capabilities: {
        general: { positionEncodings: ['utf-16'] },
        workspace: {
          configuration: true,
          workspaceFolders: true,
          didChangeWatchedFiles: { dynamicRegistration: true },
          didChangeConfiguration: { dynamicRegistration: true },
          symbol: {},
        },
        window: { workDoneProgress: true },
        textDocument: {
          synchronization: { dynamicRegistration: false },
          definition: { linkSupport: false },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          semanticTokens: {
            requests: { range: true, full: false },
            tokenTypes: STANDARD_TOKEN_TYPES,
            tokenModifiers: STANDARD_TOKEN_MODIFIERS,
            formats: ['relative'],
          },
        },
      },
    };
  }

  private wireClientObligations(conn: MessageConnection): void {
    conn.onRequest('window/workDoneProgress/create', () => null);
    conn.onRequest('client/registerCapability', () => null);
    conn.onRequest('client/unregisterCapability', () => null);
    conn.onRequest('workspace/configuration', (params: { items?: unknown[] }) =>
      (params?.items ?? []).map(() => ({})),
    );
    conn.onNotification('window/logMessage', (p: { message: string }) =>
      this.sink.log('info', p.message),
    );
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.disposed) return;
    if (this.crashGate.crash()) {
      this.sink.log('error', `LSP process exited unexpectedly (code=${code}, signal=${signal})`);
    }
    if (this.restarting) return;
    this.restarting = true;
    this.scheduleRestart();
  }

  private scheduleRestart(): void {
    if (this.disposed) {
      this.restarting = false;
      return;
    }

    const now = Date.now();
    if (now - this.restartWindowStart > JdtlsSession.RESTART_WINDOW_MS) {
      this.restartWindowStart = now;
      this.restartAttempts = 0;
    }
    this.restartAttempts++;
    if (this.restartAttempts > JdtlsSession.MAX_RESTARTS_PER_WINDOW) {
      this.sink.log(
        'error',
        `LSP process crashed ${this.restartAttempts} times within a minute; giving up`,
      );
      this.restarting = false;
      return;
    }

    const delay = Math.min(
      JdtlsSession.RESTART_MAX_DELAY_MS,
      JdtlsSession.RESTART_BASE_DELAY_MS * 2 ** (this.restartAttempts - 1),
    );
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.disposed) {
        this.restarting = false;
        return;
      }
      this.launch().then(
        () => {
          this.restarting = false;
          this.sink.log('warn', 'LSP process restarted');
        },
        (e: Error) => {
          if (this.disposed) {
            this.restarting = false;
            return;
          }
          this.crashGate.crash();
          this.sink.log('error', `LSP restart attempt failed: ${e.message}`);
          this.scheduleRestart();
        },
      );
    }, delay);
    this.restartTimer.unref?.();
  }

  private toRepoLocation(uri: string): { path: string; external: boolean } {
    const abs = fileURLToPath(uri);
    const rel = path.relative(this.plan.cwd, abs);
    const isInside =
      rel.length > 0 && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
    if (isInside) return { path: toPosix(rel), external: false };
    const stripped = toPosix(abs).replace(/^\/+/, '');
    return { path: stripped.length > 0 ? stripped : 'external', external: true };
  }

  private absPath(repoRelativePath: string): string {
    return path.join(this.plan.cwd, repoRelativePath);
  }

  private sendRequest<R>(method: string, params: unknown): Promise<R> {
    const real = this.conn.sendRequest(method, params) as Promise<R>;
    return this.crashGate.guard(real);
  }

  private withOpenDocument<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    const previous = this.docQueue.get(filePath) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const text = await readFile(filePath, 'utf8');
        const uri = pathToFileURL(filePath).toString();
        await this.conn.sendNotification('textDocument/didOpen', {
          textDocument: { uri, languageId: languageId(), version: 1, text },
        });
        try {
          return await fn(text);
        } finally {
          await this.conn.sendNotification('textDocument/didClose', { textDocument: { uri } });
        }
      });
    this.docQueue.set(
      filePath,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  async lineSymbols(filePath: string, line: number): Promise<LineSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async (text) => {
      const uri = pathToFileURL(abs).toString();
      const lineIdx0 = line - 1;
      const lineText = text.split('\n')[lineIdx0] ?? '';
      const result = await this.sendRequest<{ data: number[] } | null>(
        'textDocument/semanticTokens/range',
        {
          textDocument: { uri },
          range: {
            start: { line: lineIdx0, character: 0 },
            end: { line: lineIdx0, character: lineText.length },
          },
        },
      );
      if (!result?.data?.length) return [];

      const out: LineSymbol[] = [];
      let curLine = 0;
      let curChar = 0;
      for (let i = 0; i < result.data.length; i += 5) {
        const deltaLine = result.data[i];
        const deltaChar = result.data[i + 1];
        const length = result.data[i + 2];
        const typeIdx = result.data[i + 3];
        const modBits = result.data[i + 4];
        curLine += deltaLine;
        curChar = deltaLine === 0 ? curChar + deltaChar : deltaChar;
        if (curLine !== lineIdx0) continue;
        const modifiers = this.legend.tokenModifiers.filter((_, bi) => (modBits & (1 << bi)) !== 0);
        out.push({
          name: lineText.slice(curChar, curChar + length),
          kind: mapSemanticTokenType(
            this.legend.tokenTypes[typeIdx],
            modifiers.includes('readonly'),
          ),
          modifiers: modifiers.filter((m) => KNOWN_MODIFIERS.has(m)) as LineSymbol['modifiers'],
          range: { start: { line, col: curChar + 1 }, end: { line, col: curChar + length + 1 } },
        });
      }
      return out;
    });
  }

  async definition(filePath: string, pos: Pos): Promise<DefinitionTarget[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString();
      const raw = await this.sendRequest<
        LspLocation | LspLocationLink | (LspLocation | LspLocationLink)[] | null
      >('textDocument/definition', {
        textDocument: { uri },
        position: { line: pos.line - 1, character: pos.col - 1 },
      });

      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return list.map((item): DefinitionTarget => {
        const isLink = 'targetUri' in item;
        const uriStr = isLink ? item.targetUri : item.uri;
        const range = isLink ? (item.targetSelectionRange ?? item.targetRange) : item.range;
        const { path: repoPath, external } = this.toRepoLocation(uriStr);
        return { location: { path: repoPath, range: toRange(range) }, external };
      });
    });
  }

  async references(filePath: string, pos: Pos): Promise<FileMatches[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString();
      const raw = await this.sendRequest<LspLocation[] | null>('textDocument/references', {
        textDocument: { uri },
        position: { line: pos.line - 1, character: pos.col - 1 },
        context: { includeDeclaration: true },
      });

      const byFile = new Map<string, Match[]>();
      const textCache = new Map<string, string[]>();
      for (const loc of raw ?? []) {
        const { path: repoPath, external } = this.toRepoLocation(loc.uri);
        if (external) continue;
        const targetAbs = fileURLToPath(loc.uri);
        let lines = textCache.get(targetAbs);
        if (!lines) {
          lines = await readFile(targetAbs, 'utf8')
            .then((t) => t.split('\n'))
            .catch(() => [] as string[]);
          textCache.set(targetAbs, lines);
        }
        const lineText = lines[loc.range.start.line] ?? '';
        const matches = byFile.get(repoPath) ?? [];
        matches.push({
          line: loc.range.start.line + 1,
          preview: lineText.replace(/\r?$/, ''),
          spans: [[loc.range.start.character, loc.range.end.character]],
        });
        byFile.set(repoPath, matches);
      }
      return Array.from(byFile.entries())
        .sort(([a], [b]) => comparePaths(a, b))
        .map(([repoPath, matches]) => ({
          path: repoPath,
          matches: matches.sort((a, b) => a.line - b.line),
        }));
    });
  }

  async workspaceSymbols(query: string, limit: number): Promise<WorkspaceSymbol[]> {
    const raw = await this.sendRequest<Array<{
      name: string;
      kind: number;
      containerName?: string;
      location: LspLocation;
    }> | null>('workspace/symbol', { query });
    const out: WorkspaceSymbol[] = [];
    for (const s of raw ?? []) {
      const { path: repoPath, external } = this.toRepoLocation(s.location.uri);
      if (external) continue;
      out.push({
        name: s.name,
        kind: mapLspSymbolKind(s.kind),
        containerName: s.containerName,
        location: { path: repoPath, range: toRange(s.location.range) },
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  async documentSymbols(filePath: string): Promise<DocumentSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString();
      const raw = await this.sendRequest<LspDocumentSymbol[] | LspSymbolInformation[] | null>(
        'textDocument/documentSymbol',
        { textDocument: { uri } },
      );
      if (!raw || raw.length === 0) return [];
      if (isDocumentSymbolArray(raw)) return raw.map(toDocumentSymbol);
      return flatSymbolsToTree(raw);
    });
  }

  filesChanged(changes: FileChange[]): void {
    if (changes.length === 0) return;
    const typeOf = { created: 1, changed: 2, deleted: 3 } as const;
    this.conn
      .sendNotification('workspace/didChangeWatchedFiles', {
        changes: changes.map((c) => ({
          uri: pathToFileURL(this.absPath(c.path)).toString(),
          type: typeOf[c.type],
        })),
      })
      .catch((e: Error) => this.sink.log('warn', `didChangeWatchedFiles failed: ${e.message}`));
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await this.conn.sendRequest('shutdown');
          await this.conn.sendNotification('exit');
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('LSP shutdown handshake timed out')),
            JdtlsSession.DISPOSE_TIMEOUT_MS,
          );
          timer.unref?.();
        }),
      ]);
    } catch {
      // The server may already have exited.
    } finally {
      if (timer) clearTimeout(timer);
    }
    this.conn.dispose();
    if (this.child.exitCode === null && this.child.signalCode === null) {
      const exited = new Promise<void>((resolve) => this.child.once('exit', () => resolve()));
      this.child.kill();
      await Promise.race([
        exited,
        new Promise<void>((resolve) => setTimeout(resolve, JdtlsSession.DISPOSE_TIMEOUT_MS)),
      ]);
    }
  }
}

export default {
  id: 'java',
  displayName: 'Java',
  matches(filePath: string): boolean {
    return JAVA_EXTENSIONS.test(filePath);
  },
  languageId,
  warmupFile(files: string[]): string | undefined {
    return files.find((f) => JAVA_EXTENSIONS.test(f));
  },
  async open(
    project: { root: string },
    host: ExtensionHost,
    sink: ExtensionEvents,
  ): Promise<LanguageSession> {
    const { launcher, dir } = await materialize(host.dataDir);
    return JdtlsSession.start(
      {
        command: 'java',
        args: [
          '-jar',
          launcher,
          '-configuration',
          path.join(dir, configDirName()),
          '-data',
          path.join(host.dataDir, 'workspace', encodeURIComponent(project.root)),
        ],
        cwd: project.root,
      },
      sink,
    );
  },
};
