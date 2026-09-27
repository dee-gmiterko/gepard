import { app } from 'electron'
import { join } from 'node:path'
import { ProjectId } from '@shared/ipc/schemas/project'
import { AppError } from './ipc/registry'

export function userDataDir(): string {
  return app.getPath('userData')
}

export function nohooksDir(): string {
  return join(userDataDir(), 'nohooks')
}

export function projectsDir(): string {
  return join(userDataDir(), 'projects')
}

export function projectId(owner: string, repo: string): string {
  return `${owner}__${repo}`.toLowerCase()
}

export function projectDir(id: string): string {
  if (!ProjectId.safeParse(id).success) {
    throw new AppError('INVALID_PROJECT_ID', `invalid project id: ${id}`)
  }
  return join(projectsDir(), id)
}

export function projectJsonPath(id: string): string {
  return join(projectDir(id), 'project.json')
}

export function projectRepoDir(id: string): string {
  return join(projectDir(id), 'repo')
}

export function projectCloneTmpDir(id: string): string {
  return join(projectDir(id), 'repo.cloning')
}

export function projectReviewDir(id: string): string {
  return join(projectDir(id), 'review')
}

export function extensionsDir(): string {
  return join(userDataDir(), 'extensions')
}

export function extensionsJsonPath(): string {
  return join(userDataDir(), 'extensions.json')
}

export function extensionsFilesJsonPath(): string {
  return join(userDataDir(), 'extensions-files.json')
}

export function themeJsonPath(): string {
  return join(userDataDir(), 'theme.json')
}

export function reviewJsonPath(id: string, pr: number): string {
  return join(projectReviewDir(id), `${pr}.json`)
}

export function logsDir(): string {
  return join(userDataDir(), 'logs')
}
