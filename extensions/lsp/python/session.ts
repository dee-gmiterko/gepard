import type { ExtensionEvents } from '@gepard/common';
import { StdioLspSession, TransientDocuments, type StdioServerSpec } from '@gepard/common-lsp';
import { PYTHON_SYNTAX } from './syntax';

export class PyrightSession extends StdioLspSession {
  protected readonly documents = new TransientDocuments(this.documentHost());
  protected readonly identifierSyntax = PYTHON_SYNTAX;

  private constructor(spec: StdioServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: StdioServerSpec, sink: ExtensionEvents): Promise<PyrightSession> {
    const session = new PyrightSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(): string {
    return 'python';
  }
}
