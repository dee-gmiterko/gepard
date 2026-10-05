import { spawn } from 'node:child_process';
import { app } from 'electron';
import { AppError, type Project } from '@gepard/common';
import {
  detachedLaunchCommand,
  findProjectByName,
  isGitHubUrl,
  launchTargetFromArgv,
} from '../helpers/launch';
import * as store from '../store/projects';
import { log } from '../log';

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
    if (isGitHubUrl(this.target)) return store.addProject(this.target);
    const project = findProjectByName(await store.listProjects(), this.target);
    if (!project)
      throw new AppError(
        'BAD_INPUT',
        `unknown project "${this.target}": expected a project name (owner/repo) or a GitHub URL`,
      );
    return project;
  }

  async launchDetached(projectId: string): Promise<void> {
    const project = await store.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    const { command, args } = detachedLaunchCommand(project.url, {
      execPath: process.execPath,
      appPath: app.getAppPath(),
      defaultApp: Boolean(process.defaultApp),
      appImage: process.env['APPIMAGE'],
    });
    log.info('launch', `detached instance: ${command} ${args.join(' ')}`);
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
  }
}

export const launchService = new LaunchService(
  launchTargetFromArgv(process.argv, Boolean(process.defaultApp)),
);
