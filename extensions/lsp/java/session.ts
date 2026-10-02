import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import {
  CrashGate,
  comparePaths,
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
  type LspSymbolInformation,
  type SourceMatch,
  type SourcePos,
  type SourceWorkspaceSymbol,
} from '@gepard/common';
import {
  flatSymbolsToTree,
  isDocumentSymbolArray,
  mapLspSymbolKind,
  toDocumentSymbol,
  toLocations,
  toRange,
} from './helpers/lsp';
import {
  decodeLineSymbols,
  emptyLegend,
  legendOf,
  STANDARD_TOKEN_MODIFIERS,
  STANDARD_TOKEN_TYPES,
  type SemanticTokensLegend,
} from './helpers/semanticToken';

export interface ServerSpec {
  command: string;
  args: string[];
  cwd: string;
  root: string;
  env?: NodeJS.ProcessEnv;
}

interface RepoLocation {
  path: string;
  external: boolean;
}

export class JdtlsSession implements LanguageSession {
  private conn!: MessageConnection;
  private child!: ChildProcessWithoutNullStreams;
  private legend: SemanticTokensLegend = emptyLegend();
  private disposed = false;
  private readonly crashGate = new CrashGate();
  private docQueue = new Map<string, Promise<unknown>>();
  private restarting = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempts = 0;
  private restartWindowStart = 0;
  private static readonly MAX_RESTARTS_PER_WINDOW = 5;
  private static readonly RESTART_WINDOW_MS = 60_000;
  private static readonly RESTART_BASE_DELAY_MS = 500;
  private static readonly RESTART_MAX_DELAY_MS = 30_000;
  private static readonly DISPOSE_TIMEOUT_MS = 3_000;

  private constructor(
    private readonly spec: ServerSpec,
    private readonly sink: ExtensionEvents,
  ) {}

  static async start(spec: ServerSpec, sink: ExtensionEvents): Promise<JdtlsSession> {
    const session = new JdtlsSession(spec, sink);
    await session.launch();
    return session;
  }

  private async launch(): Promise<void> {
    this.crashGate.reset();

    const child = spawn(this.spec.command, this.spec.args, {
      cwd: this.spec.cwd,
      env: this.spec.env ?? process.env,
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

    try {
      const conn = createMessageConnection(
        new StreamMessageReader(child.stdout),
        new StreamMessageWriter(child.stdin),
      );
      this.conn = conn;
      this.wireClientObligations(conn);
      conn.listen();
      const initResult: unknown = await Promise.race([
        conn.sendRequest('initialize', this.initializeParams()),
        launchFailed,
      ]);
      this.legend = legendOf(initResult);
      await Promise.race([conn.sendNotification('initialized', {}), launchFailed]);
    } catch (e) {
      abandoned = true;
      this.conn?.dispose();
      if (child.exitCode === null && child.signalCode === null) child.kill();
      throw e;
    } finally {
      failLaunch = null;
    }
  }

  private initializeParams(): unknown {
    const rootUri = url.pathToFileURL(this.spec.root).toString();
    return {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: path.basename(this.spec.root) }],
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

  private toRepoLocation(uri: string): RepoLocation {
    const abs = url.fileURLToPath(uri);
    const rel = path.relative(this.spec.root, abs);
    const isInside =
      rel.length > 0 && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
    if (isInside) return { path: toPosix(rel), external: false };
    const stripped = toPosix(abs).replace(/^\/+/, '');
    return { path: stripped.length > 0 ? stripped : 'external', external: true };
  }

  private absPath(repoRelativePath: string): string {
    return path.join(this.spec.root, repoRelativePath);
  }

  private sendRequest<R>(method: string, params: unknown): Promise<R> {
    const real = this.conn.sendRequest<R>(method, params);
    return this.crashGate.guard(real);
  }

  private withOpenDocument<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    const previous = this.docQueue.get(filePath) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const text = await fs.readFile(filePath, 'utf8');
        const uri = url.pathToFileURL(filePath).toString();
        await this.conn.sendNotification('textDocument/didOpen', {
          textDocument: { uri, languageId: 'java', version: 1, text },
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
    const raw = await this.sendRequest<LspDefinitionResult | null>('textDocument/definition', {
      textDocument: { uri },
      position: { line: line0, character: char0 },
    });
    return toLocations(raw);
  }

  async lineSymbols(filePath: string, line: number): Promise<SourceLineSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async (text) => {
      const uri = url.pathToFileURL(abs).toString();
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
      return decodeLineSymbols(result.data, this.legend, line, lineText);
    });
  }

  async definition(filePath: string, pos: SourcePos): Promise<SourceDefinition[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = url.pathToFileURL(abs).toString();
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
      const uri = url.pathToFileURL(abs).toString();
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
        const targetAbs = url.fileURLToPath(loc.uri);
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
    const raw = await this.sendRequest<LspSymbolInformation[] | null>('workspace/symbol', {
      query,
    });
    const out: SourceWorkspaceSymbol[] = [];
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

  async documentSymbols(filePath: string): Promise<SourceDocumentSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async () => {
      const uri = url.pathToFileURL(abs).toString();
      const raw = await this.sendRequest<LspDocumentSymbol[] | LspSymbolInformation[] | null>(
        'textDocument/documentSymbol',
        { textDocument: { uri } },
      );
      if (!raw || raw.length === 0) return [];
      if (isDocumentSymbolArray(raw)) return raw.map((s) => toDocumentSymbol(s));
      return flatSymbolsToTree(raw);
    });
  }

  filesChanged(changes: FileChange[]): void {
    if (changes.length === 0) return;
    const typeOf = { created: 1, changed: 2, deleted: 3 } as const;
    this.conn
      .sendNotification('workspace/didChangeWatchedFiles', {
        changes: changes.map((c) => ({
          uri: url.pathToFileURL(this.absPath(c.path)).toString(),
          type: typeOf[c.type],
        })),
      })
      .catch((e: Error) => this.sink.log('warn', `didChangeWatchedFiles failed: ${e.message}`));
  }

  private async shutdownHandshake(): Promise<void> {
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
  }

  private async terminate(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => this.child.once('exit', () => resolve()));
    this.child.kill();
    await Promise.race([
      exited,
      new Promise<void>((resolve) => setTimeout(resolve, JdtlsSession.DISPOSE_TIMEOUT_MS)),
    ]);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    await this.shutdownHandshake();
    this.conn?.dispose();
    await this.terminate();
  }
}
