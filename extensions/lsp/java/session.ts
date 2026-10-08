import type { ExtensionEvents } from '@gepard/common';
import { StdioLspSession, TransientDocuments, type StdioServerSpec } from '@gepard/common-lsp';

export class JdtlsSession extends StdioLspSession {
  protected readonly documents = new TransientDocuments(this.documentHost());

  private constructor(spec: StdioServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: StdioServerSpec, sink: ExtensionEvents): Promise<JdtlsSession> {
    const session = new JdtlsSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(): string {
    return 'java';
  }
}
