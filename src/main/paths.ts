// `app.setName(...)` must run before any of these are called so dev and prod
// agree on the userData path.
import { app } from 'electron'
import { join } from 'node:path'

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

export function reviewJsonPath(id: string, pr: number): string {
  return join(projectReviewDir(id), `${pr}.json`)
}

export function logsDir(): string {
  return join(userDataDir(), 'logs')
}
