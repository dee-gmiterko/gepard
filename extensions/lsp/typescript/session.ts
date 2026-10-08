import { languageIdOf, type ExtensionEvents, type ExtensionLanguage } from '@gepard/common';
import { StdioLspSession, TransientDocuments, type StdioServerSpec } from '@gepard/common-lsp';

export interface ServerSpec extends StdioServerSpec {
  languages: ExtensionLanguage[];
}

export class TypeScriptSession extends StdioLspSession<ServerSpec> {
  protected readonly documents = new TransientDocuments(this.documentHost());

  private constructor(spec: ServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: ServerSpec, sink: ExtensionEvents): Promise<TypeScriptSession> {
    const session = new TypeScriptSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(filePath: string): string {
    return languageIdOf(this.spec.languages, filePath) ?? '';
  }
}
