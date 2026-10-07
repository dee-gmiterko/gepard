import { spawn } from 'node:child_process';
import { app, BrowserWindow } from 'electron';
import {
  AppError,
  type ChannelParsedInput,
  type OpenedProject,
  type Project,
} from '@gepard/common';
import { isGitHubRepoUrl } from '../helpers/github/repoUrl';
import { findProjectByName } from '../helpers/projects';
import { instanceCommand, waitForInstance } from '../helpers/process/instance';
import { ProjectLocks } from '../helpers/process/projectLock';
import { formatCaughtError } from '../helpers/error';
import { cli } from '../cli';
import * as store from '../store/projects';
import { indexer } from '../lsp';
import { projectLocksDir, projectRepoDir } from '../paths';
import { emit } from '../ipc/registry';
import { notifyMainFailure } from '../notify';
import { log } from '../log';
import { gitService, type GitService } from './git';

function focusMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

export class LaunchService {
  private projectLocks: ProjectLocks | null = null;
  private started: Promise<OpenedProject | null> | null = null;

  constructor(
    private readonly git: GitService,
    private readonly target: string | null,
  ) {}

  // Created lazily: the userData path is only valid once app.setName has run.
  private get locks(): ProjectLocks {
    this.projectLocks ??= new ProjectLocks(projectLocksDir(), focusMainWindow);
    return this.projectLocks;
  }

  startup(): Promise<OpenedProject | null> {
    this.started ??= this.openTarget();
    return this.started;
  }

  private async openTarget(): Promise<OpenedProject | null> {
    if (this.target === null) return null;
    try {
      log.info('launch', `opening ${this.target}`);
      const project = await this.resolveTarget(this.target);
      if (project.cloned) return await this.open(project.id);
      this.git.cloneProject(project.id, project.url).catch(() => undefined);
      return null;
    } catch (e) {
      notifyMainFailure('launch', formatCaughtError(e));
      return null;
    }
  }

  private async resolveTarget(target: string): Promise<Project> {
    if (isGitHubRepoUrl(target)) return store.addProject(target);
    const project = findProjectByName(await store.listProjects(), target);
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
    const project = await store.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    if (!project.cloned)
      throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`);
    await this.claim(projectId);
    const [{ head, files }, targeting, layout] = await Promise.all([
      this.git.workingTree(projectId),
      store.getLastTargeting(projectId),
      store.getLayout(projectId),
    ]);
    indexer.open(projectId, projectRepoDir(projectId), files, head).catch((e) => {
      const message = e instanceof Error ? e.message : String(e);
      log.error('launch', `indexer failed for ${projectId}: ${message}`);
      emit('index.status', { projectId, status: { state: 'error', message } });
    });
    return { project, head, targeting, layout };
  }

  // A project is open in at most one window across all running instances.
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
    const { command, args } = instanceCommand(target, {
      execPath: process.execPath,
      appPath: app.getAppPath(),
      defaultApp: Boolean(process.defaultApp),
      appImage: process.env['APPIMAGE'],
    });
    log.info('launch', `detached instance: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    child.unref();
    if (!(await waitForInstance(child))) log.warn('launch', `no window reported: ${command}`);
  }

  private async projectUrl(projectId: string): Promise<string> {
    const project = await store.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    return project.url;
  }
}

export const launchService = new LaunchService(gitService, cli.target);
