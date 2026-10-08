import { spawn, type ChildProcess } from 'node:child_process';
import * as net from 'node:net';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createMessageConnection,
  SocketMessageReader,
  SocketMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import {
  errorMessage,
  type ExtensionEvents,
  type FileChange,
  type SourceDocumentSymbol,
  type SourceLineSymbol,
  type SourceWorkspaceSymbol,
} from '@gepard/common';
import {
  LspSession,
  toDocumentSymbol,
  TransientDocuments,
  type LspDocumentSymbol,
} from '@gepard/common-lsp';
import { freePort } from './helpers/net';
import { GDSCRIPT_SYNTAX } from './helpers/identifier';
import { listScripts } from './project';
import { symbolKind, unwrapFileSymbol } from './helpers/symbol';

export interface GodotLaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  projectDir: string;
  env: NodeJS.ProcessEnv;
}

export class GodotSession extends LspSession {
  protected readonly documents = new TransientDocuments(this.documentHost());
  private socket: net.Socket | null = null;
  private connectAbort = new AbortController();
  private port = 0;
  private symbolCache = new Map<string, Promise<SourceDocumentSymbol[]>>();
  private scriptFiles: Promise<string[]> | null = null;
  private static readonly CONNECT_TIMEOUT_MS = 180_000;
  private static readonly CONNECT_RETRY_MS = 100;

  private constructor(
    private readonly plan: GodotLaunchPlan,
    sink: ExtensionEvents,
  ) {
    super(plan.cwd, sink);
  }

  static async start(plan: GodotLaunchPlan, sink: ExtensionEvents): Promise<GodotSession> {
    const session = new GodotSession(plan, sink);
    await session.launch();
    return session;
  }

  protected languageId(): string {
    return 'gdscript';
  }

  protected override beforeLaunch(): void {
    super.beforeLaunch();
    this.symbolCache.clear();
    this.closeTransport();
    this.connectAbort = new AbortController();
  }

  protected override abandonLaunch(): void {
    this.closeTransport();
  }

  protected override closeConnection(): Promise<void> {
    this.closeTransport();
    return Promise.resolve();
  }

  protected async spawnServer(): Promise<ChildProcess> {
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

  protected async connect(): Promise<MessageConnection> {
    const signal = this.connectAbort.signal;
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
    this.connectAbort.abort();
    this.conn?.dispose();
    this.socket?.destroy();
  }

  protected initializeParams(): unknown {
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

  protected wireClientObligations(conn: MessageConnection): void {
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

  protected override targetSymbols(abs: string): Promise<SourceDocumentSymbol[]> {
    return this.symbolsOf(abs);
  }

  async lineSymbols(filePath: string, line: number): Promise<SourceLineSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, (text) => {
      const lineText = text.split('\n')[line - 1] ?? '';
      return this.lineSymbolsFromDefinitions(abs, line, lineText, GDSCRIPT_SYNTAX);
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
}
