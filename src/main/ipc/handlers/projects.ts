// Projects domain: viewer prefill, project registry, clone.
// This file owns exactly these channels and no others.
import type { HandlerMap } from '../registry'
import { AppError } from '../registry'
import * as store from '../../store/projects'
import * as gh from '../../services/gh'
import * as git from '../../services/git'
import { indexer } from '../../lsp'
import { projectRepoDir } from '../../paths'

export const projectsHandlers: Pick<
  HandlerMap,
  | 'app.viewer'
  | 'projects.list'
  | 'projects.add'
  | 'projects.open'
  | 'projects.remove'
  | 'clone.start'
> = {
  'app.viewer': () => gh.viewer(),

  'projects.list': () => store.listProjects(),

  'projects.add': ({ url }) => store.addProject(url),

  /** Idempotent: starts the background index (spec: "Opened project is
   * indexed in background" — not awaited; progress and failures arrive as
   * `index.status`) and returns the checked-out sha. */
  'projects.open': async ({ projectId }) => {
    const project = await store.getProject(projectId)
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`)
    if (!project.cloned)
      throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`)
    const { head, files } = await git.workingTree(projectId)
    void indexer.open(projectId, projectRepoDir(projectId), files, head)
    return { project, head }
  },

  'projects.remove': async ({ projectId }) => {
    await indexer.close(projectId)
    await store.removeProject(projectId)
  },

  /** Returns at once; the clone itself runs in the background and reports
   * through `clone.progress`, including its own 'error' phase on failure. */
  'clone.start': async ({ projectId }) => {
    const project = await store.getProject(projectId)
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`)
    // cloneProject already logged the failure and pushed it to the renderer
    // as a `clone.progress` 'error' event (which toasts it); swallowing here
    // only keeps the rejection from becoming an unhandledRejection, so the
    // failure is logged exactly once.
    void git.cloneProject(projectId, project.url).catch(() => undefined)
  }
}
