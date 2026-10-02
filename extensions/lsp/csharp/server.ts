import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ExtensionEvents,
  type ExtensionHost,
  type LanguageSession,
  materializePayload,
  packageRoot,
} from '@gepard/common';
import { RoslynSession } from './session';

const SERVER_DLL = path.join('lib', 'Microsoft.CodeAnalysis.LanguageServer.dll');

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
      label: 'Roslyn language server payload',
      probe: SERVER_DLL,
    },
    host.dataDir,
  );
  const logDir = path.join(host.dataDir, 'logs');
  await mkdir(logDir, { recursive: true });
  return RoslynSession.start(
    {
      command: 'dotnet',
      args: [
        path.join(dir, SERVER_DLL),
        '--logLevel',
        'Warning',
        '--extensionLogDirectory',
        logDir,
        '--stdio',
      ],
      cwd: logDir,
      root: project.root,
    },
    sink,
  );
}
