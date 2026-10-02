import { mkdir } from 'node:fs/promises';
import type { ExtensionEvents, ExtensionHost, LanguageSession } from '@gepard/common';
import { editorEnv, findProjectDir, PROJECT_FILE } from './project';
import { GodotSession } from './session';

export async function open(
  project: { root: string },
  host: ExtensionHost,
  sink: ExtensionEvents,
): Promise<LanguageSession> {
  const projectDir = await findProjectDir(project.root);
  if (!projectDir) {
    throw new Error(`no ${PROJECT_FILE} found under ${project.root}`);
  }
  const env = editorEnv(host.dataDir);
  await Promise.all(Object.values(env).map((dir) => mkdir(dir, { recursive: true })));
  return GodotSession.start(
    {
      command: 'godot',
      args: ['--headless', '--editor'],
      cwd: project.root,
      projectDir,
      env,
    },
    sink,
  );
}
