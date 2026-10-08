import * as fs from 'node:fs/promises';
import * as url from 'node:url';
import type { MessageConnection } from 'vscode-jsonrpc/node';
import type { ExtensionEvents } from '@gepard/common';

export interface DocumentHost {
  connection(): MessageConnection;
  languageId(filePath: string): string;
  closed(filePath: string): void;
  sink: ExtensionEvents;
}

export interface DocumentSync {
  withOpen<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T>;
  reset?(): void;
  invalidate?(filePath: string): void;
}

// Opens the document for the duration of one request, serialised per file.
export class TransientDocuments implements DocumentSync {
  private queue = new Map<string, Promise<unknown>>();

  constructor(private readonly host: DocumentHost) {}

  withOpen<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    const previous = this.queue.get(filePath) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const conn = this.host.connection();
        const text = await fs.readFile(filePath, 'utf8');
        const uri = url.pathToFileURL(filePath).toString();
        await conn.sendNotification('textDocument/didOpen', {
          textDocument: { uri, languageId: this.host.languageId(filePath), version: 1, text },
        });
        try {
          return await fn(text);
        } finally {
          this.host.closed(filePath);
          try {
            await conn.sendNotification('textDocument/didClose', { textDocument: { uri } });
          } catch {
            // The connection may already be gone.
          }
        }
      });
    this.queue.set(
      filePath,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}

// Keeps the most recently used documents open so servers can reuse their parse.
export class RecentDocuments implements DocumentSync {
  private openDocs = new Map<string, string>();
  private openLock: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly host: DocumentHost,
    private readonly limit = 8,
  ) {}

  withOpen<T>(filePath: string, fn: (text: string) => Promise<T>): Promise<T> {
    const run = this.openLock
      .catch(() => undefined)
      .then(async () => {
        const conn = this.host.connection();
        const text = await fs.readFile(filePath, 'utf8');
        const uri = url.pathToFileURL(filePath).toString();
        if (this.openDocs.has(filePath)) {
          this.openDocs.delete(filePath);
          this.openDocs.set(filePath, uri);
          return text;
        }
        await conn.sendNotification('textDocument/didOpen', {
          textDocument: { uri, languageId: this.host.languageId(filePath), version: 1, text },
        });
        this.openDocs.set(filePath, uri);
        while (this.openDocs.size > this.limit) {
          const oldest = this.openDocs.keys().next().value;
          if (oldest === undefined) break;
          this.invalidate(oldest);
        }
        return text;
      });
    this.openLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(fn);
  }

  reset(): void {
    this.openDocs.clear();
  }

  invalidate(filePath: string): void {
    const uri = this.openDocs.get(filePath);
    if (uri === undefined) return;
    this.openDocs.delete(filePath);
    this.host.closed(filePath);
    const close = (): Promise<void> =>
      this.host.connection().sendNotification('textDocument/didClose', { textDocument: { uri } });
    Promise.resolve()
      .then(close)
      .catch((e: Error) => this.host.sink.log('warn', `didClose failed: ${e.message}`));
  }
}
