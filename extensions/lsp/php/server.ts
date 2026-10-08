import type {
  ExtensionEvents,
  ExtensionHost,
  ExtensionLanguage,
  LanguageSession,
} from '@gepard/common';
import { ensurePhpantom } from './binary';
import { prepareConfig } from './config';
import { PhpantomSession } from './session';

export async function open(
  project: { root: string },
  host: ExtensionHost,
  sink: ExtensionEvents,
  languages: ExtensionLanguage[],
): Promise<LanguageSession> {
  const [phpantom, env] = await Promise.all([
    ensurePhpantom(host.dataDir),
    prepareConfig(host.dataDir),
  ]);
  return PhpantomSession.start(
    {
      command: phpantom,
      args: ['--stdio'],
      cwd: project.root,
      root: project.root,
      env,
      languages,
    },
    sink,
  );
}
