import { app } from 'electron';
import { join } from 'node:path';
import { z } from 'zod';
import { ProjectId, AppError } from '@gepard/common';

export function userDataDir(): string {
  return app.getPath('userData');
}

export function nohooksDir(): string {
  return join(userDataDir(), 'nohooks');
}

export function projectsDir(): string {
  return join(userDataDir(), 'projects');
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

export const ExtensionKindDir = z.enum(['lsp', 'grammars', 'themes', 'locales']);
export type ExtensionKindDir = z.infer<typeof ExtensionKindDir>;

export function extensionsRootDir(): string {
  return join(userDataDir(), 'extensions');
}

export function userExtensionsDir(kind: ExtensionKindDir): string {
  return join(extensionsRootDir(), kind);
}

export function builtinExtensionsDir(kind: ExtensionKindDir): string {
  const root = app.isPackaged
    ? join(process.resourcesPath, 'extensions')
    : join(app.getAppPath(), '..', '..', 'extensions');
  return join(root, kind);
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
