import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createMessageConnection,
  SocketMessageReader,
  SocketMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import {
  CrashGate,
  comparePaths,
  errorMessage,
  toPosix,
  type SourceDefinition,
  type SourceDocumentSymbol,
  type ExtensionEvents,
  type FileChange,
  type FileReferences,
  type LanguageSession,
  type SourceLineSymbol,
  type LspDefinitionResult,
  type LspDocumentSymbol,
  type LspLocation,
  type SourceMatch,
  type SourcePos,
  type SourceWorkspaceSymbol,
  terminateChild,
} from '@gepard/common';
import { freePort } from './helpers/net';
import { identifiersOn } from './helpers/identifier';
import { toDocumentSymbol, toLocations, toRange } from './helpers/lsp';
import { listScripts } from './project';
import { findSymbolAt, symbolKind, unwrapFileSymbol } from './helpers/symbol';

export interface GodotLaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  projectDir: string;
  env: NodeJS.ProcessEnv;
}

interface RepoLocation {
  path: string;
  external: boolean;
}

export class GodotSession implements LanguageSession {
  private conn!: MessageConnection;
  private child!: ChildProcess;
  private disposed = false;
  private readonly crashGate = new CrashGate();
  private docQueue = new Map<string, Promise<unknown>>();
  private restarting = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempts = 0;
  private restartWindowStart = 0;
  private socket: net.Socket | null = null;
  private connectAbort: AbortController | null = null;
  private port = 0;
  private symbolCache = new Map<string, Promise<SourceDocumentSymbol[]>>();
  private scriptFiles: Promise<string[]> | null = null;
  private static readonly MAX_RESTARTS_PER_WINDOW = 5;
  private static readonly RESTART_WINDOW_MS = 60_000;
  private static readonly RESTART_BASE_DELAY_MS = 500;
  private static readonly RESTART_MAX_DELAY_MS = 30_000;
  private static readonly DISPOSE_TIMEOUT_MS = 1_000;
  private static readonly CONNECT_TIMEOUT_MS = 180_000;
  private static readonly CONNECT_RETRY_MS = 100;

  private constructor(
    private readonly plan: GodotLaunchPlan,
    private readonly sink: ExtensionEvents,
  ) {}

  static async start(plan: GodotLaunchPlan, sink: ExtensionEvents): Promise<GodotSession> {
    const session = new GodotSession(plan, sink);
    await session.launch();
    return session;
  }

  private async launch(): Promise<void> {
    this.symbolCache.clear();
    this.closeTransport();
    const connectAbort = new AbortController();
    this.connectAbort = connectAbort;

    const child = await this.spawnServer();
    this.child = child;
    let failLaunch: ((e: Error) => void) | null = null;
    let abandoned = false;
    const launchFailed = new Promise<never>((_, reject) => {
      failLaunch = reject;
    });
    child.on('error', (err) => {
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

    let conn: MessageConnection | undefined;
    try {
      conn = await Promise.race([this.connect(connectAbort.signal), launchFailed]);
      this.wireClientObligations(conn);
      conn.listen();
      await Promise.race([conn.sendRequest('initialize', this.initializeParams()), launchFailed]);
      await Promise.race([conn.sendNotification('initialized', {}), launchFailed]);
      this.conn = conn;
      this.crashGate.reset();
    } catch (e) {
      abandoned = true;
      conn?.dispose();
      this.closeTransport();
      await terminateChild(child, GodotSession.DISPOSE_TIMEOUT_MS);
      throw e;
    } finally {
      failLaunch = null;
    }
  }

  private async spawnServer(): Promise<ChildProcess> {
    this.port = await freePort();
    const child = spawn(
      this.plan.command,
      [...this.plan.args, '--lsp-port', String(this.port), '--path', this.plan.projectDir],
      {
        cwd: this.plan.cwd,
        env: { ...process.env, ...this.plan.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout?.on('data', (d: Buffer) => this.sink.log('info', d.toString('utf8').trim()));
    child.stderr?.on('data', (d: Buffer) => this.sink.log('info', d.toString('utf8').trim()));
    return child;
  }

  private async connect(signal: AbortSignal): Promise<MessageConnection> {
    const socket = await this.connectSocket(this.port, signal);
    if (signal.aborted) {
      socket.destroy();
      throw new Error('LSP connection attempt was abandoned');
    }
    this.socket = socket;
    return createMessageConnection(
      new SocketMessageReader(socket),
      new SocketMessageWriter(socket),
    );
  }

  private async connectSocket(port: number, signal: AbortSignal): Promise<net.Socket> {
    const deadline = Date.now() + GodotSession.CONNECT_TIMEOUT_MS;
    for (;;) {
      if (signal.aborted) throw new Error('LSP connection attempt was abandoned');
      try {
        return await new Promise<net.Socket>((resolve, reject) => {
          const socket = net.connect(port, '127.0.0.1');
          const onAbort = (): void => {
            socket.destroy();
            reject(new Error('LSP connection attempt was abandoned'));
          };
          signal.addEventListener('abort', onAbort, { once: true });
          socket.once('connect', () => {
            signal.removeEventListener('abort', onAbort);
            socket.removeListener('error', reject);
            resolve(socket);
          });
          socket.once('error', (err) => {
            signal.removeEventListener('abort', onAbort);
            reject(err);
          });
        });
      } catch (e) {
        if (signal.aborted) throw e;
        if (Date.now() > deadline) {
          throw new Error(
            `LSP server did not accept connections on port ${port}: ${errorMessage(e)}`,
            { cause: e },
          );
        }
        await new Promise<void>((resolve) => {
          const onAbort = (): void => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
          }, GodotSession.CONNECT_RETRY_MS);
          signal.addEventListener('abort', onAbort, { once: true });
        });
      }
    }
  }

  private closeTransport(): void {
    this.connectAbort?.abort();
    this.conn?.dispose();
    this.socket?.destroy();
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

  private toRepoLocation(uri: string): RepoLocation {
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
    return this.crashGate.guard(
      Promise.resolve().then(() => this.conn.sendRequest<R>(method, params)),
    );
  }

  private withOpenDocument<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    const previous = this.docQueue.get(filePath) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const conn = this.conn;
        const text = await fs.readFile(filePath, 'utf8');
        const uri = pathToFileURL(filePath).toString();
        await conn.sendNotification('textDocument/didOpen', {
          textDocument: { uri, languageId: 'gdscript', version: 1, text },
        });
        try {
          return await fn(text);
        } finally {
          try {
            await conn.sendNotification('textDocument/didClose', { textDocument: { uri } });
          } catch {
            // The connection may already be gone.
          }
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
    const raw = await this.sendRequest<LspDefinitionResult | null>('textDocument/definition', {
      textDocument: { uri },
      position: { line: line0, character: char0 },
    });
    return toLocations(raw);
  }

  private symbolsOf(abs: string): Promise<SourceDocumentSymbol[]> {
    let cached = this.symbolCache.get(abs);
    if (!cached) {
      cached = this.sendRequest<LspDocumentSymbol[] | null>('textDocument/documentSymbol', {
        textDocument: { uri: pathToFileURL(abs).toString() },
      }).then((raw) => (raw ?? []).map((s) => toDocumentSymbol(s, symbolKind)));
      this.symbolCache.set(abs, cached);
      cached.catch(() => this.symbolCache.delete(abs));
    }
    return cached;
  }

  private scripts(): Promise<string[]> {
    if (!this.scriptFiles) this.scriptFiles = listScripts(this.plan.projectDir);
    return this.scriptFiles;
  }

  async lineSymbols(filePath: string, line: number): Promise<SourceLineSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async (text) => {
      const uri = pathToFileURL(abs).toString();
      const lineIdx0 = line - 1;
      const lineText = text.split('\n')[lineIdx0] ?? '';
      const out: SourceLineSymbol[] = [];
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

  async definition(filePath: string, pos: SourcePos): Promise<SourceDefinition[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString();
      const list = await this.requestDefinition(uri, pos.line - 1, pos.col - 1);
      return list.map((item): SourceDefinition => {
        const { path: repoPath, external } = this.toRepoLocation(item.uri);
        return { location: { path: repoPath, range: toRange(item.range) }, external };
      });
    });
  }

  async references(filePath: string, pos: SourcePos): Promise<FileReferences[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = pathToFileURL(abs).toString();
      const raw = await this.sendRequest<LspLocation[] | null>('textDocument/references', {
        textDocument: { uri },
        position: { line: pos.line - 1, character: pos.col - 1 },
        context: { includeDeclaration: true },
      });

      const byFile = new Map<string, SourceMatch[]>();
      const textCache = new Map<string, string[]>();
      for (const loc of raw ?? []) {
        const { path: repoPath, external } = this.toRepoLocation(loc.uri);
        if (external) continue;
        const targetAbs = fileURLToPath(loc.uri);
        let lines = textCache.get(targetAbs);
        if (!lines) {
          lines = await fs
            .readFile(targetAbs, 'utf8')
            .then((t) => t.split('\n'))
            .catch((): string[] => []);
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

  async workspaceSymbols(query: string, limit: number): Promise<SourceWorkspaceSymbol[]> {
    const needle = query.trim().toLowerCase();
    const files = await this.scripts();
    const trees = await Promise.all(
      files.map(async (abs) => ({
        abs,
        symbols: unwrapFileSymbol(await this.symbolsOf(abs).catch(() => [])),
      })),
    );
    const out: SourceWorkspaceSymbol[] = [];
    const visit = (abs: string, symbols: SourceDocumentSymbol[], containerName?: string): void => {
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

  async documentSymbols(filePath: string): Promise<SourceDocumentSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      this.symbolCache.delete(abs);
      return unwrapFileSymbol(await this.symbolsOf(abs));
    });
  }

  filesChanged(changes: FileChange[]): void {
    const relevant = changes.filter((c) => c.path.endsWith('.gd'));
    if (relevant.length === 0) return;
    this.scriptFiles = null;
    for (const change of relevant) {
      const abs = this.absPath(change.path);
      this.symbolCache.delete(abs);
      if (change.type === 'deleted') continue;
      this.withOpenDocument(abs, () => Promise.resolve()).catch((e: Error) =>
        this.sink.log('warn', `reparse of ${change.path} failed: ${e.message}`),
      );
    }
  }

  private terminate(): Promise<void> {
    return terminateChild(this.child, GodotSession.DISPOSE_TIMEOUT_MS);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.closeTransport();
    await this.terminate();
  }
}
