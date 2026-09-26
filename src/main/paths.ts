// userData layout (report 04 §4.1):
//
// <userData>/
//   nohooks/                      EMPTY dir used as core.hooksPath
//   projects/
//     <owner>__<repo>/            id = lowercase "owner__repo"
//       project.json              url, owner, repo, addedAt
//       repo/                     the clone; working tree checked out per target
//       repo.cloning/             in-progress clone, renamed to repo/ when done
//       review/<pr>.json          local threads, comments, viewed state
//
// `app.setName(...)` must run before any of these are called so dev and prod
// agree on the userData path (report 04 §4.1).
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

/** id = lowercase "owner__repo" */
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

/** Where a clone runs until it completed (then renamed to `repo/`), so
 * `repo/` existing means the clone finished. */
export function projectCloneTmpDir(id: string): string {
  return join(projectDir(id), 'repo.cloning')
}

export function projectReviewDir(id: string): string {
  return join(projectDir(id), 'review')
}

export function reviewJsonPath(id: string, pr: number): string {
  return join(projectReviewDir(id), `${pr}.json`)
}

/** `<userData>/logs/`, holds `main.log` (src/main/log.ts). */
export function logsDir(): string {
  return join(userDataDir(), 'logs')
}
