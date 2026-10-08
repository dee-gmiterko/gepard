import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ExtensionEvents,
  ExtensionHost,
  ExtensionLanguage,
  LanguageSession,
} from '@gepard/common';
import { materializePayload, packageRoot } from '@gepard/common-lsp';
import { TypeScriptSession } from './session';

const TARGET = `${process.platform}-${process.arch}`;
const EXE_NAME = process.platform === 'win32' ? 'tsc.exe' : 'tsc';

export async function open(
  project: { root: string },
  host: ExtensionHost,
  sink: ExtensionEvents,
  languages: ExtensionLanguage[],
): Promise<LanguageSession> {
  const dir = await materializePayload(
    {
      vendorDir: path.join(
        await packageRoot(path.dirname(fileURLToPath(import.meta.url))),
        'vendor',
        TARGET,
      ),
      label: `TypeScript payload for ${TARGET}`,
      probe: EXE_NAME,
      installName: (version) => `${version}-${TARGET}`,
    },
    host.dataDir,
  );
  return TypeScriptSession.start(
    {
      command: path.join(dir, EXE_NAME),
      args: ['--lsp', '--stdio'],
      cwd: project.root,
      root: project.root,
      languages,
    },
    sink,
  );
}
