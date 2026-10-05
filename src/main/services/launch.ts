import { spawn } from 'node:child_process';
import { app } from 'electron';
import { AppError, type Project } from '@gepard/common';
import { isGitHubRepoUrl } from '../helpers/github/repoUrl';
import { findProjectByName } from '../helpers/projects';
import { WINDOW_SHOWN_MARKER, appCommand, waitForLine } from '../helpers/process/instance';
import { REPORT_WINDOW_SHOWN, cli } from '../cli';
import * as store from '../store/projects';
import { log } from '../log';

const WINDOW_SHOWN_TIMEOUT_MS = 15_000;

export class LaunchService {
  private resolved: Promise<Project | null> | null = null;

  constructor(private readonly target: string | null) {}

  project(): Promise<Project | null> {
    this.resolved ??= this.resolveTarget();
    return this.resolved;
  }

  private async resolveTarget(): Promise<Project | null> {
    if (this.target === null) return null;
    log.info('launch', `opening ${this.target}`);
    if (isGitHubRepoUrl(this.target)) return store.addProject(this.target);
    const project = findProjectByName(await store.listProjects(), this.target);
    if (!project)
      throw new AppError(
        'BAD_INPUT',
        `unknown project "${this.target}": expected a project name (owner/repo) or a GitHub URL`,
      );
    return project;
  }

  async launchDetached(projectId: string): Promise<Project> {
    const project = await store.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    const { command, args } = appCommand([project.url, `--${REPORT_WINDOW_SHOWN}`], {
      execPath: process.execPath,
      appPath: app.getAppPath(),
      defaultApp: Boolean(process.defaultApp),
      appImage: process.env['APPIMAGE'],
    });
    log.info('launch', `detached instance: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    child.unref();
    const shown = await waitForLine(child, WINDOW_SHOWN_MARKER, WINDOW_SHOWN_TIMEOUT_MS);
    if (!shown)
      log.warn('launch', `no window reported within ${WINDOW_SHOWN_TIMEOUT_MS}ms: ${command}`);
    return project;
  }
}

export const launchService = new LaunchService(cli.target);
