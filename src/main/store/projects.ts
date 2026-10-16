import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { z } from 'zod';
import {
  Project,
  PersistedLayout,
  PersistedTargeting,
  AppError,
  parseGitHubRepoUrl,
} from '@gepard/common';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';
import { formatCaughtError } from '../helpers/error';
import { projectId as makeProjectId, type Paths } from '../main/paths';
import type { LoggerService } from '../main/log';
import type { FileLockService } from '../services/fileLock';

const ProjectFile = Project.omit({ cloned: true }).extend({
  lastTargeting: PersistedTargeting.optional(),
  layout: PersistedLayout.optional(),
});
type ProjectFile = z.infer<typeof ProjectFile>;

const NO_TARGETING: PersistedTargeting = { pr: null, commit: null, path: null };
const DEFAULT_LAYOUT: PersistedLayout = PersistedLayout.parse({});

function toProject(file: ProjectFile, cloned: boolean): Project {
  const { id, url, owner, repo, addedAt } = file;
  return { id, url, owner, repo, addedAt, cloned };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class ProjectStore {
  constructor(
    private readonly paths: Paths,
    private readonly logger: LoggerService,
    private readonly locks: FileLockService,
  ) {}

  async isCloned(id: string): Promise<boolean> {
    return pathExists(this.paths.projectRepoDir(id));
  }

  private async readProjectFile(id: string): Promise<ProjectFile | null> {
    return readJsonFile(this.paths.projectJsonPath(id), ProjectFile, () => null);
  }

  private updateProjectFile(id: string, update: (file: ProjectFile) => ProjectFile): Promise<void> {
    return this.locks.withLock(this.paths.writeLockPath(`project-${id}`), async () => {
      const file = await this.readProjectFile(id);
      if (!file) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${id}`);
      await this.writeProjectFile(id, update(file));
    });
  }

  private async writeProjectFile(id: string, data: ProjectFile): Promise<void> {
    await writeJsonFile(this.paths.projectJsonPath(id), data);
  }

  async listProjects(): Promise<Project[]> {
    await mkdir(this.paths.projectsDir(), { recursive: true });
    const entries = await readdir(this.paths.projectsDir(), { withFileTypes: true });
    const projects: Project[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const file = await this.readProjectFile(entry.name);
        if (!file) continue;
        projects.push(toProject(file, await this.isCloned(entry.name)));
      } catch (e) {
        this.logger.error('projects', `skipping ${entry.name}: ${formatCaughtError(e)}`);
      }
    }
    projects.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    return projects;
  }

  async getProject(id: string): Promise<Project | null> {
    const file = await this.readProjectFile(id);
    if (!file) return null;
    return toProject(file, await this.isCloned(id));
  }

  async getLastTargeting(id: string): Promise<PersistedTargeting> {
    const file = await this.readProjectFile(id);
    return file?.lastTargeting ?? NO_TARGETING;
  }

  async setLastTargeting(id: string, targeting: PersistedTargeting): Promise<void> {
    await this.updateProjectFile(id, (file) => ({ ...file, lastTargeting: targeting }));
  }

  async getLayout(id: string): Promise<PersistedLayout> {
    const file = await this.readProjectFile(id);
    return file?.layout ?? DEFAULT_LAYOUT;
  }

  async setLayout(id: string, layout: PersistedLayout): Promise<void> {
    await this.updateProjectFile(id, (file) => ({ ...file, layout }));
  }

  async addProject(url: string): Promise<Project> {
    const { owner, repo } = parseGitHubRepoUrl(url);
    const id = makeProjectId(owner, repo);
    const existing = await this.readProjectFile(id);
    if (existing) return toProject(existing, await this.isCloned(id));
    const data: ProjectFile = {
      id,
      url: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
      addedAt: new Date().toISOString(),
    };
    await this.writeProjectFile(id, data);
    return { ...data, cloned: false };
  }

  async removeProject(id: string): Promise<void> {
    await rm(this.paths.projectDir(id), { recursive: true, force: true });
  }
}
