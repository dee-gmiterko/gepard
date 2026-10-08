import {
  languageIdOf,
  type ExtensionEvents,
  type ExtensionLanguage,
  type FileChange,
} from '@gepard/common';
import { RecentDocuments, StdioLspSession, type StdioServerSpec } from '@gepard/common-lsp';
import { isSourceFile } from './compdb';

export interface ServerSpec extends StdioServerSpec {
  languages: ExtensionLanguage[];
  refreshCompileCommands?: () => Promise<void>;
}

export class ClangdSession extends StdioLspSession<ServerSpec> {
  protected readonly documents = new RecentDocuments(this.documentHost());

  private constructor(spec: ServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: ServerSpec, sink: ExtensionEvents): Promise<ClangdSession> {
    const session = new ClangdSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(filePath: string): string {
    return languageIdOf(this.spec.languages, filePath) ?? 'cpp';
  }

  protected override beforeFilesChangedNotify(changes: FileChange[]): Promise<void> {
    const refresh = this.spec.refreshCompileCommands;
    const unitsChanged = changes.some((c) => c.type !== 'changed' && isSourceFile(c.path));
    return refresh && unitsChanged ? refresh() : Promise.resolve();
  }
}
