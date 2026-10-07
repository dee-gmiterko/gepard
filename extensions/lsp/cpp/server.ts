import type {
  ExtensionEvents,
  ExtensionHost,
  ExtensionLanguage,
  LanguageSession,
} from '@gepard/common';
import { ensureClangd } from './binary';
import { prepareCompileCommands } from './compdb';
import { ClangdSession } from './session';

export async function open(
  project: { root: string },
  host: ExtensionHost,
  sink: ExtensionEvents,
  languages: ExtensionLanguage[],
): Promise<LanguageSession> {
  const clangd = await ensureClangd(host.dataDir);
  const compdb = await prepareCompileCommands(project.root, host.dataDir);
  return ClangdSession.start(
    {
      command: clangd,
      args: [
        '--background-index',
        '--background-index-priority=low',
        '--pch-storage=disk',
        '--limit-references=10000',
        '--limit-results=1000',
        '--log=error',
        `--compile-commands-dir=${compdb.dir}`,
      ],
      cwd: compdb.dir,
      root: project.root,
      languages,
      refreshCompileCommands: compdb.generated ? compdb.refresh : undefined,
    },
    sink,
  );
}
