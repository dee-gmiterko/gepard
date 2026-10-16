import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../../paths';
import type { LoggerService } from '../../log';
import type { IpcEventService } from '../../ipc/events';

export interface TmpDir {
  path: string;
  cleanup: () => Promise<void>;
}

export async function makeTmpDir(prefix: string): Promise<TmpDir> {
  const path = await mkdtemp(join(tmpdir(), `gepard-${prefix}-`));
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) };
}

export interface UserData extends TmpDir {
  paths: Paths;
  userDir: string;
}

export async function makeUserData(): Promise<UserData> {
  const tmp = await makeTmpDir('userdata');
  const userDir = join(tmp.path, 'user');
  await mkdir(userDir, { recursive: true });
  return {
    ...tmp,
    userDir,
    paths: new Paths(userDir, join(tmp.path, 'extensions')),
  };
}

export const silentLogger: LoggerService = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  filePath: () => '',
};

export interface EmittedEvent {
  channel: string;
  payload: unknown;
}

export function collectEvents(events: IpcEventService): EmittedEvent[] {
  const emitted: EmittedEvent[] = [];
  events.subscribe((channel, payload) => {
    emitted.push({ channel, payload });
  });
  return emitted;
}
