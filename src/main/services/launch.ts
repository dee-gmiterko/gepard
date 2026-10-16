import {
  AppError,
  isGitHubRepoUrl,
  type ChannelParsedInput,
  type OpenedProject,
  type Project,
} from '@gepard/common';
import { findProjectByName } from '../helpers/projects';
import { ProjectLocks } from '../helpers/process/projectLock';
import { formatCaughtError } from '../helpers/error';
import type { ProjectStore } from '../store/projects';
import type { IndexerService } from '../lsp/indexer';
import type { Paths } from '../paths';
import type { LoggerService } from '../log';
import type { InstanceLauncher } from '../instanceLauncher';
import type { IpcEventService } from '../ipc/events';
import type { NotifyService } from '../notify';
import type { GitService } from './git';

export class LaunchService {
  private readonly locks: ProjectLocks;
  private started: Promise<OpenedProject | null> | null = null;

  constructor(
    private readonly git: GitService,
    private readonly store: ProjectStore,
    private readonly indexer: IndexerService,
    private readonly events: IpcEventService,
    private readonly notify: NotifyService,
    private readonly target: string | null,
    private readonly paths: Paths,
    private readonly logger: LoggerService,
    private readonly instances: InstanceLauncher,
    focusWindow: () => void,
  ) {
    this.locks = new ProjectLocks(paths.projectLocksDir(), focusWindow);
  }

  startup(): Promise<OpenedProject | null> {
    this.started ??= this.openTarget();
    return this.started;
  }

  private async openTarget(): Promise<OpenedProject | null> {
    if (this.target === null) return null;
    try {
      this.logger.info('launch', `opening ${this.target}`);
      const project = await this.resolveTarget(this.target);
      if (project.cloned) return await this.open(project.id);
      this.git.cloneProject(project.id, project.url).catch(() => undefined);
      return null;
    } catch (e) {
      this.notify.mainFailure('launch', formatCaughtError(e));
      return null;
    }
  }

  private async resolveTarget(target: string): Promise<Project> {
    if (isGitHubRepoUrl(target)) return this.store.addProject(target);
    const project = findProjectByName(await this.store.listProjects(), target);
    if (!project)
      throw new AppError(
        'BAD_INPUT',
        `unknown project "${target}": expected a project name (owner/repo) or a GitHub URL`,
      );
    return project;
  }

  async launch(input: ChannelParsedInput<'app.launch'>): Promise<OpenedProject | null> {
    if (!input.detached) return this.open(input.projectId);
    await this.launchDetached(input.projectId);
    return null;
  }

  async open(projectId: string): Promise<OpenedProject> {
    const project = await this.store.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    if (!project.cloned)
      throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`);
    await this.claim(projectId);
    const [{ head, files }, targeting, layout] = await Promise.all([
      this.git.workingTree(projectId),
      this.store.getLastTargeting(projectId),
      this.store.getLayout(projectId),
    ]);
    this.indexer.open(projectId, this.paths.projectRepoDir(projectId), files, head).catch((e) => {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error('launch', `indexer failed for ${projectId}: ${message}`);
      this.events.emit('index.status', { projectId, status: { state: 'error', message } });
    });
    return { project, head, targeting, layout };
  }

  private async claim(projectId: string): Promise<void> {
    const result = await this.locks.acquire(projectId);
    if (!result.acquired) {
      await this.locks.requestFocus(projectId);
      throw new AppError(
        'PROJECT_LOCKED',
        `project ${projectId} is already open in another window (pid ${result.ownerPid})`,
      );
    }
    for (const other of this.locks.heldProjects()) {
      if (other !== projectId) this.locks.release(other);
    }
  }

  private async launchDetached(projectId: string | null): Promise<void> {
    if (projectId !== null && (await this.locks.ownerOf(projectId)) !== null) {
      await this.locks.requestFocus(projectId);
      throw new AppError(
        'PROJECT_LOCKED',
        `project ${projectId} is already open in another window`,
      );
    }
    const target = projectId === null ? null : await this.projectUrl(projectId);
    await this.instances.launch(target);
  }

  private async projectUrl(projectId: string): Promise<string> {
    const project = await this.store.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    return project.url;
  }
}
