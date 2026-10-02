import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ExtensionEvents,
  type ExtensionHost,
  type LanguageSession,
  materializePayload,
  packageRoot,
} from '@gepard/common';
import { PyrightSession } from './session';

const SERVER_ENTRY = path.join('dist', 'pyright-langserver.js');

export async function open(
  project: { root: string },
  host: ExtensionHost,
  sink: ExtensionEvents,
): Promise<LanguageSession> {
  const dir = await materializePayload(
    {
      vendorDir: path.join(
        await packageRoot(path.dirname(fileURLToPath(import.meta.url))),
        'vendor',
      ),
      label: 'Pyright payload',
      probe: SERVER_ENTRY,
    },
    host.dataDir,
  );
  return PyrightSession.start(
    {
      command: process.execPath,
      args: [path.join(dir, SERVER_ENTRY), '--stdio'],
      cwd: project.root,
      root: project.root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    },
    sink,
  );
}
