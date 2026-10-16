import { homedir } from 'node:os';
import { join } from 'node:path';
import { ProjectId, AppError } from '@gepard/common';

export function projectId(owner: string, repo: string): string {
  return `${owner}__${repo}`.toLowerCase();
}

export function resolveUserDataDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  home: string = homedir(),
): string {
  if (platform === 'win32') return join(env['APPDATA'] ?? home, 'gepard');
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'gepard');
  return join(env['XDG_CONFIG_HOME'] ?? join(home, '.config'), 'gepard');
}

export class Paths {
  constructor(
    private readonly userDataDir: string,
    readonly appPath: string,
    readonly packaged: boolean,
  ) {}

  nohooksDir(): string {
    return join(this.userDataDir, 'nohooks');
  }

  projectsDir(): string {
    return join(this.userDataDir, 'projects');
  }

  projectLocksDir(): string {
    return join(this.userDataDir, 'locks');
  }

  writeLockPath(name: string): string {
    return join(this.projectLocksDir(), `write-${encodeURIComponent(name)}.lock`);
  }

  projectDir(id: string): string {
    if (!ProjectId.safeParse(id).success) {
      throw new AppError('INVALID_PROJECT_ID', `invalid project id: ${id}`);
    }
    return join(this.projectsDir(), id);
  }

  projectJsonPath(id: string): string {
    return join(this.projectDir(id), 'project.json');
  }

  projectRepoDir(id: string): string {
    return join(this.projectDir(id), 'repo');
  }

  projectCloneTmpDir(id: string): string {
    return join(this.projectDir(id), 'repo.cloning');
  }

  projectReviewDir(id: string): string {
    return join(this.projectDir(id), 'review');
  }

  extensionsRootDir(): string {
    return join(this.userDataDir, 'extensions');
  }

  builtinExtensionsDir(): string {
    return this.packaged
      ? join(this.appPath, '..', 'extensions')
      : join(this.appPath, '..', '..', 'dist', 'extensions');
  }

  extensionDataDir(id: string): string {
    return join(this.userDataDir, 'extensions-data', encodeURIComponent(id));
  }

  extensionsFilesJsonPath(): string {
    return join(this.userDataDir, 'extensions-files.json');
  }

  settingsJsonPath(): string {
    return join(this.userDataDir, 'settings.json');
  }

  reviewJsonPath(id: string, pr: number | null): string {
    return join(this.projectReviewDir(id), `${pr ?? 'unassigned'}.json`);
  }

  logsDir(): string {
    return join(this.userDataDir, 'logs');
  }
}
