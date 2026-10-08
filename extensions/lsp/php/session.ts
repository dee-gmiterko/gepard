import type { MessageConnection } from 'vscode-jsonrpc/node';
import { languageIdOf, type ExtensionEvents, type ExtensionLanguage } from '@gepard/common';
import { RecentDocuments, StdioLspSession, type StdioServerSpec } from '@gepard/common-lsp';

export interface ServerSpec extends StdioServerSpec {
  languages: ExtensionLanguage[];
}

const INDEX_PROGRESS_TOKEN = 'phpantom/full-index';

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms).unref?.());
}

export class PhpantomSession extends StdioLspSession<ServerSpec> {
  protected readonly documents = new RecentDocuments(this.documentHost());
  private indexed: Promise<void> = Promise.resolve();
  private static readonly INDEX_TIMEOUT_MS = 60_000;

  private constructor(spec: ServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: ServerSpec, sink: ExtensionEvents): Promise<PhpantomSession> {
    const session = new PhpantomSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(filePath: string): string {
    return languageIdOf(this.spec.languages, filePath) ?? 'php';
  }

  protected override wireClientObligations(conn: MessageConnection): void {
    super.wireClientObligations(conn);
    this.indexed = new Promise((resolve) => {
      conn.onNotification('$/progress', (p: { token?: unknown; value?: { kind?: string } }) => {
        if (p.token === INDEX_PROGRESS_TOKEN && p.value?.kind === 'end') resolve();
      });
    });
  }

  protected override async afterInitialized(launchFailed: Promise<never>): Promise<void> {
    await Promise.race([this.indexed, launchFailed, timeout(PhpantomSession.INDEX_TIMEOUT_MS)]);
  }
}
