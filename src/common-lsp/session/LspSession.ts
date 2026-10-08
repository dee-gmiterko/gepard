import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import type { MessageConnection } from 'vscode-jsonrpc/node';
import {
  comparePaths,
  type ExtensionEvents,
  type FileChange,
  type FileReferences,
  type LanguageSession,
  type SourceDefinition,
  type SourceDocumentSymbol,
  type SourceLineSymbol,
  type SourceMatch,
  type SourcePos,
  type SourceWorkspaceSymbol,
} from '@gepard/common';
import { identifiersOn, type IdentifierSyntax } from '../helpers/identifier';
import { toDocumentSymbols, toLocations, toRange } from '../helpers/lsp';
import type {
  LspDefinitionResult,
  LspDocumentSymbol,
  LspLocation,
  LspSymbolInformation,
} from '../helpers/protocol';
import { toRepoLocation, type RepoLocation } from '../helpers/repoLocation';
import { findSymbolAt } from '../helpers/symbol';
import { CrashGate } from './crashGate';
import type { DocumentHost, DocumentSync } from './documents';
import { terminateChild } from './terminateChild';

export abstract class LspSession<C extends ChildProcess = ChildProcess> implements LanguageSession {
  protected conn!: MessageConnection;
  protected child!: C;
  protected disposed = false;
  protected readonly crashGate = new CrashGate();
  protected abstract readonly documents: DocumentSync;
  private restarting = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempts = 0;
  private restartWindowStart = 0;
  private static readonly MAX_RESTARTS_PER_WINDOW = 5;
  private static readonly RESTART_WINDOW_MS = 60_000;
  private static readonly RESTART_BASE_DELAY_MS = 500;
  private static readonly RESTART_MAX_DELAY_MS = 30_000;
  protected static readonly DISPOSE_TIMEOUT_MS = 1_000;

  protected constructor(
    protected readonly root: string,
    protected readonly sink: ExtensionEvents,
  ) {}

  protected abstract spawnServer(): C | Promise<C>;
  protected abstract connect(child: C): MessageConnection | Promise<MessageConnection>;
  protected abstract initializeParams(): unknown;
  protected abstract wireClientObligations(conn: MessageConnection): void;
  protected abstract languageId(filePath: string): string;

  protected onInitialize?(initializeResult: unknown): void;
  protected afterInitialized?(launchFailed: Promise<never>): Promise<void>;
  protected abandonLaunch?(): void;
  protected onUnexpectedExit?(): void;
  protected onDocumentClosed?(filePath: string): void;

  abstract lineSymbols(filePath: string, line: number): Promise<SourceLineSymbol[]>;
  abstract workspaceSymbols(query: string, limit: number): Promise<SourceWorkspaceSymbol[]>;
  abstract documentSymbols(filePath: string): Promise<SourceDocumentSymbol[]>;
  abstract filesChanged(changes: FileChange[]): void;

  protected documentHost(): DocumentHost {
    return {
      connection: () => this.conn,
      languageId: (filePath) => this.languageId(filePath),
      closed: (filePath) => this.onDocumentClosed?.(filePath),
      sink: this.sink,
    };
  }

  protected beforeLaunch(): void {
    this.documents.reset?.();
  }

  protected async launch(): Promise<void> {
    this.beforeLaunch();
    const spawned = this.spawnServer();
    // Spawn errors arrive on the next tick, so a synchronous spawn must get its listeners first.
    const child = spawned instanceof Promise ? await spawned : spawned;
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
      let connecting = this.connect(child);
      if (connecting instanceof Promise)
        connecting = await Promise.race([connecting, launchFailed]);
      conn = connecting;
      this.wireClientObligations(conn);
      conn.listen();
      const initResult: unknown = await Promise.race([
        conn.sendRequest('initialize', this.initializeParams()),
        launchFailed,
      ]);
      this.onInitialize?.(initResult);
      await Promise.race([conn.sendNotification('initialized', {}), launchFailed]);
      await this.afterInitialized?.(launchFailed);
      this.conn = conn;
      this.crashGate.reset();
    } catch (e) {
      abandoned = true;
      conn?.dispose();
      this.abandonLaunch?.();
      await terminateChild(child, LspSession.DISPOSE_TIMEOUT_MS);
      throw e;
    } finally {
      failLaunch = null;
    }
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.disposed) return;
    this.onUnexpectedExit?.();
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
    if (now - this.restartWindowStart > LspSession.RESTART_WINDOW_MS) {
      this.restartWindowStart = now;
      this.restartAttempts = 0;
    }
    this.restartAttempts++;
    if (this.restartAttempts > LspSession.MAX_RESTARTS_PER_WINDOW) {
      this.sink.log(
        'error',
        `LSP process crashed ${this.restartAttempts} times within a minute; giving up`,
      );
      this.restarting = false;
      return;
    }

    const delay = Math.min(
      LspSession.RESTART_MAX_DELAY_MS,
      LspSession.RESTART_BASE_DELAY_MS * 2 ** (this.restartAttempts - 1),
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

  protected toRepoLocation(uri: string): RepoLocation {
    return toRepoLocation(this.root, uri);
  }

  protected absPath(repoRelativePath: string): string {
    return path.join(this.root, repoRelativePath);
  }

  protected sendRequest<R>(method: string, params: unknown): Promise<R> {
    return this.crashGate.guard(
      Promise.resolve().then(() => this.conn.sendRequest<R>(method, params)),
    );
  }

  protected withOpenDocument<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    return this.documents.withOpen(filePath, fn);
  }

  protected async requestDefinition(
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

  protected async targetSymbols(abs: string): Promise<SourceDocumentSymbol[]> {
    const raw = await this.sendRequest<LspDocumentSymbol[] | LspSymbolInformation[] | null>(
      'textDocument/documentSymbol',
      { textDocument: { uri: url.pathToFileURL(abs).toString() } },
    );
    return toDocumentSymbols(raw);
  }

  // For servers without semantic tokens: each identifier's kind comes from its definition target.
  protected async lineSymbolsFromDefinitions(
    abs: string,
    line: number,
    lineText: string,
    syntax: IdentifierSyntax,
  ): Promise<SourceLineSymbol[]> {
    const uri = url.pathToFileURL(abs).toString();
    const lineIdx0 = line - 1;
    const symbolsByFile = new Map<string, Promise<SourceDocumentSymbol[]>>();
    const symbolsOf = (targetAbs: string): Promise<SourceDocumentSymbol[]> => {
      let symbols = symbolsByFile.get(targetAbs);
      if (!symbols) {
        symbols = this.targetSymbols(targetAbs).catch(() => []);
        symbolsByFile.set(targetAbs, symbols);
      }
      return symbols;
    };
    const out: SourceLineSymbol[] = [];
    for (const { name, col0 } of identifiersOn(lineText, syntax)) {
      const targets = await this.requestDefinition(uri, lineIdx0, col0);
      if (targets.length === 0) continue;
      const target = targets[0];
      const targetPos = toRange(target.range).start;
      const targetAbs = target.uri.startsWith('file:') ? url.fileURLToPath(target.uri) : null;
      const symbol = targetAbs ? findSymbolAt(await symbolsOf(targetAbs), targetPos) : null;
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

  protected async closeConnection(): Promise<void> {
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
            LspSession.DISPOSE_TIMEOUT_MS,
          );
          timer.unref?.();
        }),
      ]);
    } catch {
      // The server may already have exited.
    } finally {
      if (timer) clearTimeout(timer);
    }
    this.conn?.dispose();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    await this.closeConnection();
    await terminateChild(this.child, LspSession.DISPOSE_TIMEOUT_MS);
  }
}
