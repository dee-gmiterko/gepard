import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import type {
  ExtensionEvents,
  FileChange,
  SourceDocumentSymbol,
  SourceLineSymbol,
  SourceWorkspaceSymbol,
} from '@gepard/common';
import type { IdentifierSyntax } from '../helpers/identifier';
import { mapLspSymbolKind, toDocumentSymbols, toRange } from '../helpers/lsp';
import type { LspDocumentSymbol, LspSymbolInformation } from '../helpers/protocol';
import {
  decodeLineSymbols,
  emptyLegend,
  semanticTokensSupportOf,
  STANDARD_TOKEN_MODIFIERS,
  STANDARD_TOKEN_TYPES,
  type SemanticTokensSupport,
} from '../helpers/semanticToken';
import { LspSession } from './LspSession';

export interface StdioServerSpec {
  command: string;
  args: string[];
  cwd: string;
  root: string;
  env?: NodeJS.ProcessEnv;
}

interface SemanticTokens {
  data: number[];
}

export abstract class StdioLspSession<
  S extends StdioServerSpec = StdioServerSpec,
> extends LspSession<ChildProcessWithoutNullStreams> {
  private semanticTokens: SemanticTokensSupport = { legend: emptyLegend(), request: null };
  private fullTokens = new Map<string, Promise<SemanticTokens | null>>();
  // Used to derive line symbols from definitions when the server serves no semantic tokens.
  protected readonly identifierSyntax?: IdentifierSyntax;

  protected beforeFilesChangedNotify?(changes: FileChange[]): Promise<void>;

  protected constructor(
    protected readonly spec: S,
    sink: ExtensionEvents,
  ) {
    super(spec.root, sink);
  }

  protected spawnServer(): ChildProcessWithoutNullStreams {
    const child = spawn(this.spec.command, this.spec.args, {
      cwd: this.spec.cwd,
      env: this.spec.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stderr.on('data', (d: Buffer) => this.sink.log('warn', d.toString('utf8').trim()));
    return child;
  }

  protected connect(child: ChildProcessWithoutNullStreams): MessageConnection {
    return createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin),
    );
  }

  protected override beforeLaunch(): void {
    super.beforeLaunch();
    this.fullTokens.clear();
  }

  protected override onInitialize(initializeResult: unknown): void {
    this.semanticTokens = semanticTokensSupportOf(initializeResult);
  }

  protected override onDocumentClosed(filePath: string): void {
    this.fullTokens.delete(filePath);
  }

  protected override onUnexpectedExit(): void {
    this.conn?.dispose();
  }

  protected initializeParams(): unknown {
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
            requests: { range: true, full: true },
            tokenTypes: STANDARD_TOKEN_TYPES,
            tokenModifiers: STANDARD_TOKEN_MODIFIERS,
            formats: ['relative'],
          },
        },
      },
    };
  }

  protected wireClientObligations(conn: MessageConnection): void {
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

  private requestRangeTokens(
    uri: string,
    lineIdx0: number,
    lineText: string,
  ): Promise<SemanticTokens | null> {
    return this.sendRequest<SemanticTokens | null>('textDocument/semanticTokens/range', {
      textDocument: { uri },
      range: {
        start: { line: lineIdx0, character: 0 },
        end: { line: lineIdx0, character: lineText.length },
      },
    });
  }

  private requestFullTokens(abs: string, uri: string): Promise<SemanticTokens | null> {
    let tokens = this.fullTokens.get(abs);
    if (!tokens) {
      const request = this.sendRequest<SemanticTokens | null>('textDocument/semanticTokens/full', {
        textDocument: { uri },
      });
      request.catch(() => {
        if (this.fullTokens.get(abs) === request) this.fullTokens.delete(abs);
      });
      this.fullTokens.set(abs, request);
      tokens = request;
    }
    return tokens;
  }

  async lineSymbols(filePath: string, line: number): Promise<SourceLineSymbol[]> {
    const abs = this.absPath(filePath);
    return this.withOpenDocument(abs, async (text) => {
      const uri = url.pathToFileURL(abs).toString();
      const lineIdx0 = line - 1;
      const lineText = text.split('\n')[lineIdx0] ?? '';
      const { legend, request } = this.semanticTokens;
      if (request === null) {
        if (!this.identifierSyntax) return [];
        return this.lineSymbolsFromDefinitions(abs, line, lineText, this.identifierSyntax);
      }
      const result =
        request === 'range'
          ? await this.requestRangeTokens(uri, lineIdx0, lineText)
          : await this.requestFullTokens(abs, uri);
      if (!result?.data?.length) return [];
      return decodeLineSymbols(result.data, legend, line, lineText);
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
      return toDocumentSymbols(raw);
    });
  }

  filesChanged(changes: FileChange[]): void {
    if (changes.length === 0) return;
    for (const c of changes) {
      const abs = this.absPath(c.path);
      this.fullTokens.delete(abs);
      this.documents.invalidate?.(abs);
    }
    const typeOf = { created: 1, changed: 2, deleted: 3 } as const;
    const notify = (): Promise<void> =>
      this.conn.sendNotification('workspace/didChangeWatchedFiles', {
        changes: changes.map((c) => ({
          uri: url.pathToFileURL(this.absPath(c.path)).toString(),
          type: typeOf[c.type],
        })),
      });
    const prepared = this.beforeFilesChangedNotify?.(changes);
    (prepared ? prepared.then(notify) : notify()).catch((e: Error) =>
      this.sink.log('warn', `didChangeWatchedFiles failed: ${e.message}`),
    );
  }
}
