import { join } from 'node:path';
import { ProjectId, AppError } from '@gepard/common';

export const packaged = __dirname.includes('app.asar');

let dataDir: string | null = null;

export function setUserDataDir(dir: string): void {
  dataDir = dir;
}

export function userDataDir(): string {
  if (dataDir === null) throw new Error('user data dir is not set');
  return dataDir;
}

const APP_ROOT_FROM_MAIN_OUTPUT = join('..', '..');

export function appPath(): string {
  return join(__dirname, APP_ROOT_FROM_MAIN_OUTPUT);
}

export function nohooksDir(): string {
  return join(userDataDir(), 'nohooks');
}

export function projectsDir(): string {
  return join(userDataDir(), 'projects');
}

export function projectLocksDir(): string {
  return join(userDataDir(), 'locks');
}

export function writeLockPath(name: string): string {
  return join(projectLocksDir(), `write-${encodeURIComponent(name)}.lock`);
}

export function projectId(owner: string, repo: string): string {
  return `${owner}__${repo}`.toLowerCase();
}

export function projectDir(id: string): string {
  if (!ProjectId.safeParse(id).success) {
    throw new AppError('INVALID_PROJECT_ID', `invalid project id: ${id}`);
  }
  return join(projectsDir(), id);
}

export function projectJsonPath(id: string): string {
  return join(projectDir(id), 'project.json');
}

export function projectRepoDir(id: string): string {
  return join(projectDir(id), 'repo');
}

export function projectCloneTmpDir(id: string): string {
  return join(projectDir(id), 'repo.cloning');
}

export function projectReviewDir(id: string): string {
  return join(projectDir(id), 'review');
}

export function extensionsRootDir(): string {
  return join(userDataDir(), 'extensions');
}

export function builtinExtensionsDir(): string {
  return packaged
    ? join(appPath(), '..', 'extensions')
    : join(appPath(), '..', '..', 'dist', 'extensions');
}

export function extensionDataDir(id: string): string {
  return join(userDataDir(), 'extensions-data', encodeURIComponent(id));
}

export function extensionsFilesJsonPath(): string {
  return join(userDataDir(), 'extensions-files.json');
}

export function settingsJsonPath(): string {
  return join(userDataDir(), 'settings.json');
}

export function reviewJsonPath(id: string, pr: number | null): string {
  return join(projectReviewDir(id), `${pr ?? 'unassigned'}.json`);
}

export function logsDir(): string {
  return join(userDataDir(), 'logs');
}
