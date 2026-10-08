import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionEvents, ExtensionHost, LanguageSession } from '@gepard/common';
import { materializePayload, packageRoot } from '@gepard/common-lsp';
import { JdtlsSession } from './session';

function configDirName(): string {
  if (process.platform === 'darwin') return 'config_mac';
  if (process.platform === 'win32') return 'config_win';
  return 'config_linux';
}

async function launcherJar(pluginsDir: string): Promise<string> {
  const name = (await readdir(pluginsDir)).find((f) =>
    f.startsWith('org.eclipse.equinox.launcher_'),
  );
  if (!name) throw new Error(`equinox launcher jar not found in ${pluginsDir}`);
  return path.join(pluginsDir, name);
}

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
      label: 'Eclipse JDT Language Server payload',
      probe: 'plugins',
    },
    host.dataDir,
  );
  const launcher = await launcherJar(path.join(dir, 'plugins'));
  return JdtlsSession.start(
    {
      command: 'java',
      args: [
        '-jar',
        launcher,
        '-configuration',
        path.join(dir, configDirName()),
        '-data',
        path.join(host.dataDir, 'workspace', encodeURIComponent(project.root)),
      ],
      cwd: project.root,
      root: project.root,
    },
    sink,
  );
}
