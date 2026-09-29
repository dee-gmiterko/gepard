import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import * as net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import {
  createMessageConnection,
  SocketMessageReader,
  SocketMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
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

const GD_EXTENSIONS = /\.gd$/;
const PROJECT_FILE = 'project.godot';
const SKIPPED_DIRS = new Set(['.git', '.godot', 'node_modules']);

function languageId(): string {
  return 'gdscript';
}

async function findProjectDir(root: string): Promise<string | null> {
  let level = [root];
  while (level.length > 0) {
    const next: string[] = [];
    for (const dir of level) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      if (entries.some((e) => e.isFile() && e.name === PROJECT_FILE)) return dir;
      for (const e of entries) {
        if (e.isDirectory() && !SKIPPED_DIRS.has(e.name)) next.push(path.join(dir, e.name));
      }
    }
    level = next.sort();
  }
  return null;
}

async function listScripts(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIPPED_DIRS.has(e.name)) out.push(...(await listScripts(file)));
    } else if (GD_EXTENSIONS.test(e.name)) out.push(file);
  }
  return out;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

function editorEnv(dataDir: string): NodeJS.ProcessEnv {
  const editorDir = path.join(dataDir, 'editor');
  if (process.platform === 'win32') {
    return {
      APPDATA: path.join(editorDir, 'roaming'),
      LOCALAPPDATA: path.join(editorDir, 'local'),
    };
  }
  if (process.platform === 'darwin') return {};
  return {
    XDG_CONFIG_HOME: path.join(editorDir, 'config'),
    XDG_DATA_HOME: path.join(editorDir, 'data'),
    XDG_CACHE_HOME: path.join(editorDir, 'cache'),
  };
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
    case 24:
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

function toDocumentSymbol(s: LspDocumentSymbol): DocumentSymbol {
  return {
    name: s.name,
    kind: mapLspSymbolKind(s.kind),
    range: toRange(s.range),
    selectionRange: toRange(s.selectionRange),
    children: (s.children ?? []).map(toDocumentSymbol),
  };
}

function unwrapFileSymbol(tree: DocumentSymbol[]): DocumentSymbol[] {
  if (tree.length === 1 && tree[0].kind === 'class' && tree[0].range.start.line === 1) {
    return tree[0].children;
  }
  return tree;
}

function findSymbolAt(symbols: DocumentSymbol[], pos: Pos): DocumentSymbol | null {
  for (const s of symbols) {
    if (s.selectionRange.start.line === pos.line && s.selectionRange.start.col === pos.col)
      return s;
    const inner = findSymbolAt(s.children, pos);
    if (inner) return inner;
  }
  return null;
}

const GD_KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'await',
  'break',
  'breakpoint',
  'class',
  'class_name',
  'const',
  'continue',
  'elif',
  'else',
  'enum',
  'extends',
  'false',
  'for',
  'func',
  'if',
  'in',
  'is',
  'match',
  'not',
  'null',
  'or',
  'pass',
  'preload',
  'return',
  'self',
  'signal',
  'static',
  'super',
  'true',
  'var',
  'void',
  'when',
  'while',
  'yield',
  'INF',
  'NAN',
  'PI',
  'TAU',
]);

function maskStringsAndComments(line: string): string {
  const out = line.split('');
  let quote: string | null = null;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (quote) {
      if (ch === '\\' && i + 1 < out.length) {
        out[i] = ' ';
        out[++i] = ' ';
        continue;
      }
      if (ch === quote) quote = null;
      out[i] = ' ';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out[i] = ' ';
    } else if (ch === '#') {
      for (let j = i; j < out.length; j++) out[j] = ' ';
      break;
    }
  }
  return out.join('');
}

function identifiersOn(line: string): Array<{ name: string; col0: number }> {
  const masked = maskStringsAndComments(line);
  const out: Array<{ name: string; col0: number }> = [];
  for (const m of masked.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (GD_KEYWORDS.has(m[0])) continue;
    if (m.index > 0 && masked[m.index - 1] === '$') continue;
    out.push({ name: m[0], col0: m.index });
  }
  return out;
}

interface LaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  projectDir: string;
  env: NodeJS.ProcessEnv;
}

class GodotSession implements LanguageSession {
  private conn!: MessageConnection;
  private child!: ChildProcess;
  private socket: net.Socket | null = null;
  private docQueue = new Map<string, Promise<unknown>>();
  private symbolCache = new Map<string, Promise<DocumentSymbol[]>>();
  private scriptFiles: Promise<string[]> | null = null;
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
  private static readonly CONNECT_TIMEOUT_MS = 180_000;
  private static readonly CONNECT_RETRY_MS = 100;
  private crashGate = new CrashGate();

  private constructor(
    private readonly plan: LaunchPlan,
    private readonly sink: ExtensionEvents,
  ) {}

  static async start(plan: LaunchPlan, sink: ExtensionEvents): Promise<GodotSession> {
    const session = new GodotSession(plan, sink);
    await session.launch();
    return session;
  }

  private async launch(): Promise<void> {
    this.crashGate.reset();
    this.symbolCache.clear();

    const port = await freePort();
    const child = spawn(
      this.plan.command,
      [...this.plan.args, '--lsp-port', String(port), '--path', this.plan.projectDir],
      {
        cwd: this.plan.cwd,
        env: { ...process.env, ...this.plan.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    this.child = child;
    child.stdout?.on('data', (d: Buffer) => this.sink.log('info', d.toString('utf8').trim()));
    child.stderr?.on('data', (d: Buffer) => this.sink.log('info', d.toString('utf8').trim()));
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

    let socket: net.Socket | null = null;
    let conn: MessageConnection | null = null;
    try {
      socket = await Promise.race([this.connect(port), launchFailed]);
      this.socket = socket;
      conn = createMessageConnection(
        new SocketMessageReader(socket),
        new SocketMessageWriter(socket),
      );
      this.conn = conn;
      this.wireClientObligations(conn);
      conn.listen();
      await Promise.race([conn.sendRequest('initialize', this.initializeParams()), launchFailed]);
      await Promise.race([conn.sendNotification('initialized', {}), launchFailed]);
    } catch (e) {
      abandoned = true;
      conn?.dispose();
      socket?.destroy();
      if (child.exitCode === null && child.signalCode === null) child.kill();
      throw e;
    } finally {
      failLaunch = null;
    }
  }

  private async connect(port: number): Promise<net.Socket> {
    const deadline = Date.now() + GodotSession.CONNECT_TIMEOUT_MS;
    for (;;) {
      try {
        return await new Promise<net.Socket>((resolve, reject) => {
          const socket = net.connect(port, '127.0.0.1');
          socket.once('connect', () => {
            socket.removeListener('error', reject);
            resolve(socket);
          });
          socket.once('error', reject);
        });
      } catch (e) {
        if (Date.now() > deadline) {
          throw new Error(
            `LSP server did not accept connections on port ${port}: ${(e as Error).message}`,
          );
        }
        await new Promise((r) => setTimeout(r, GodotSession.CONNECT_RETRY_MS));
      }
    }
  }

  private initializeParams(): unknown {
    const rootUri = pathToFileURL(this.plan.projectDir).toString();
    return {
      processId: process.pid,
      rootUri,
      rootPath: this.plan.projectDir,
      workspaceFolders: [{ uri: rootUri, name: path.basename(this.plan.projectDir) }],
      capabilities: {
        workspace: { symbol: {} },
        textDocument: {
          synchronization: { dynamicRegistration: false },
          definition: { linkSupport: false },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        },
      },
    };
  }

  private wireClientObligations(conn: MessageConnection): void {
    conn.onNotification('gdscript/capabilities', () => {});
    conn.onNotification('gdscript/show_native_symbol', () => {});
    conn.onNotification('textDocument/publishDiagnostics', () => {});
    conn.onNotification('window/showMessage', (p: { message: string }) =>
      this.sink.log('info', p.message),
    );
    conn.onNotification('window/logMessage', (p: { message: string }) =>
      this.sink.log('info', p.message),
    );
    conn.onNotification('gdscript_client/changeWorkspace', (p: { path: string }) =>
      this.sink.log('warn', `LSP server is serving a different project: ${p.path}`),
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
    if (now - this.restartWindowStart > GodotSession.RESTART_WINDOW_MS) {
      this.restartWindowStart = now;
      this.restartAttempts = 0;
    }
    this.restartAttempts++;
    if (this.restartAttempts > GodotSession.MAX_RESTARTS_PER_WINDOW) {
      this.sink.log(
        'error',
        `LSP process crashed ${this.restartAttempts} times within a minute; giving up`,
      );
      this.restarting = false;
      return;
    }

    const delay = Math.min(
      GodotSession.RESTART_MAX_DELAY_MS,
      GodotSession.RESTART_BASE_DELAY_MS * 2 ** (this.restartAttempts - 1),
    );
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.disposed) {
        this.restarting = false;
        return;
      }
      this.conn?.dispose();
      this.socket?.destroy();
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

  private async requestDefinition(
    uri: string,
    line0: number,
    char0: number,
  ): Promise<LspLocation[]> {
    const raw = await this.sendRequest<
      LspLocation | LspLocationLink | (LspLocation | LspLocationLink)[] | null
    >('textDocument/definition', {
      textDocument: { uri },
      position: { line: line0, character: char0 },
    });
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.map((item) =>
      'targetUri' in item
        ? { uri: item.targetUri, range: item.targetSelectionRange ?? item.targetRange }
        : item,
    );
  }

  private symbolsOf(abs: string): Promise<DocumentSymbol[]> {
    let cached = this.symbolCache.get(abs);
    if (!cached) {
      cached = this.sendRequest<LspDocumentSymbol[] | null>('textDocument/documentSymbol', {
        textDocument: { uri: pathToFileURL(abs).toString() },
      }).then((raw) => (raw ?? []).map(toDocumentSymbol));
      this.symbolCache.set(abs, cached);
      cached.catch(() => this.symbolCache.delete(abs));
    }
    return cached;
  }

  private scripts(): Promise<string[]> {
    if (!this.scriptFiles) this.scriptFiles = listScripts(this.plan.projectDir);
    return this.scriptFiles;
  }

  async lineSymbols(filePath: string, line: number): Promise<LineSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async (text) => {
      const uri = pathToFileURL(abs).toString();
      const lineIdx0 = line - 1;
      const lineText = text.split('\n')[lineIdx0] ?? '';
      const out: LineSymbol[] = [];
      for (const { name, col0 } of identifiersOn(lineText)) {
        const targets = await this.requestDefinition(uri, lineIdx0, col0);
        if (targets.length === 0) continue;
        const target = targets[0];
        const targetPos = toRange(target.range).start;
        const targetAbs = fileURLToPath(target.uri);
        const symbol = findSymbolAt(await this.symbolsOf(targetAbs).catch(() => []), targetPos);
        const isDeclaration =
          targetAbs === abs && targetPos.line === line && targetPos.col === col0 + 1;
        out.push({
          name,
          kind: symbol?.kind ?? 'unknown',
          modifiers: isDeclaration ? ['declaration'] : [],
          range: { start: { line, col: col0 + 1 }, end: { line, col: col0 + name.length + 1 } },
        });
      }
      return out;
    });
  }

  async definition(filePath: string, pos: Pos): Promise<DefinitionTarget[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString();
      const list = await this.requestDefinition(uri, pos.line - 1, pos.col - 1);
      return list.map((item): DefinitionTarget => {
        const { path: repoPath, external } = this.toRepoLocation(item.uri);
        return { location: { path: repoPath, range: toRange(item.range) }, external };
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
    const needle = query.trim().toLowerCase();
    const files = await this.scripts();
    const trees = await Promise.all(
      files.map(async (abs) => ({
        abs,
        symbols: unwrapFileSymbol(await this.symbolsOf(abs).catch(() => [])),
      })),
    );
    const out: WorkspaceSymbol[] = [];
    const visit = (abs: string, symbols: DocumentSymbol[], containerName?: string): void => {
      for (const s of symbols) {
        if (out.length >= limit) return;
        if (!needle || s.name.toLowerCase().includes(needle)) {
          const { path: repoPath, external } = this.toRepoLocation(pathToFileURL(abs).toString());
          if (!external) {
            out.push({
              name: s.name,
              kind: s.kind,
              containerName,
              location: { path: repoPath, range: s.selectionRange },
            });
          }
        }
        visit(abs, s.children, s.name);
      }
    };
    for (const { abs, symbols } of trees) {
      if (out.length >= limit) break;
      visit(abs, symbols);
    }
    return out;
  }

  async documentSymbols(filePath: string): Promise<DocumentSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      this.symbolCache.delete(abs);
      return unwrapFileSymbol(await this.symbolsOf(abs));
    });
  }

  filesChanged(changes: FileChange[]): void {
    const relevant = changes.filter((c) => GD_EXTENSIONS.test(c.path));
    if (relevant.length === 0) return;
    this.scriptFiles = null;
    for (const change of relevant) {
      const abs = this.absPath(change.path);
      this.symbolCache.delete(abs);
      if (change.type === 'deleted') continue;
      this.withOpenDocument(abs, async () => undefined).catch((e: Error) =>
        this.sink.log('warn', `reparse of ${change.path} failed: ${e.message}`),
      );
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.conn?.dispose();
    this.socket?.destroy();
    if (this.child.exitCode === null && this.child.signalCode === null) {
      const exited = new Promise<void>((resolve) => this.child.once('exit', () => resolve()));
      this.child.kill();
      const timely = await Promise.race([
        exited.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), GodotSession.DISPOSE_TIMEOUT_MS),
        ),
      ]);
      if (!timely) {
        this.child.kill('SIGKILL');
        await Promise.race([
          exited,
          new Promise<void>((resolve) => setTimeout(resolve, GodotSession.DISPOSE_TIMEOUT_MS)),
        ]);
      }
    }
  }
}

export default {
  id: 'gdscript',
  displayName: 'GDScript',
  matches(filePath: string): boolean {
    return GD_EXTENSIONS.test(filePath);
  },
  languageId,
  warmupFile(files: string[]): string | undefined {
    return files.find((f) => GD_EXTENSIONS.test(f));
  },
  async open(
    project: { root: string },
    host: ExtensionHost,
    sink: ExtensionEvents,
  ): Promise<LanguageSession> {
    const projectDir = await findProjectDir(project.root);
    if (!projectDir) {
      throw new Error(`no ${PROJECT_FILE} found under ${project.root}`);
    }
    const env = editorEnv(host.dataDir);
    await Promise.all(Object.values(env).map((dir) => mkdir(dir!, { recursive: true })));
    return GodotSession.start(
      {
        command: 'godot',
        args: ['--headless', '--editor'],
        cwd: project.root,
        projectDir,
        env,
      },
      sink,
    );
  },
};
