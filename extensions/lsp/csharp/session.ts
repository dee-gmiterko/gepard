import type { ExtensionEvents } from '@gepard/common';
import { StdioLspSession, TransientDocuments, type StdioServerSpec } from '@gepard/common-lsp';

export class RoslynSession extends StdioLspSession {
  protected readonly documents = new TransientDocuments(this.documentHost());

  private constructor(spec: StdioServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: StdioServerSpec, sink: ExtensionEvents): Promise<RoslynSession> {
    const session = new RoslynSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(): string {
    return 'csharp';
  }
}
