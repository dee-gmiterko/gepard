import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { MissingDependencyError } from '@gepard/common';

const WINDOWS_DEFAULT_PATHEXT = '.EXE;.CMD;.BAT;.COM';

async function isExecutableFile(file: string): Promise<boolean> {
  try {
    await fs.access(file, constants.X_OK);
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

function hasDirectory(command: string): boolean {
  return command.includes('/') || command.includes(path.sep);
}

export async function findCommand(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const dirs = hasDirectory(command)
    ? [path.dirname(path.resolve(command))]
    : (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const name = hasDirectory(command) ? path.basename(command) : command;
  const extensions =
    process.platform === 'win32'
      ? ['', ...(env.PATHEXT ?? WINDOWS_DEFAULT_PATHEXT).split(';').filter(Boolean)]
      : [''];
  for (const dir of dirs) {
    for (const extension of extensions) {
      const file = path.join(dir, name + extension);
      if (await isExecutableFile(file)) return file;
    }
  }
  return null;
}

export async function requireCommand(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const found = await findCommand(command, env);
  if (found === null) throw new MissingDependencyError(command);
  return found;
}
