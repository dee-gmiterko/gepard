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
  | 'app.viewerRepos'
  | 'projects.list'
  | 'projects.add'
  | 'projects.open'
  | 'projects.setTargeting'
  | 'projects.remove'
  | 'clone.start'
> = {
  'app.viewer': () => gh.viewer(),

  'app.viewerRepos': () => gh.listViewerRepos(),

  'projects.list': () => store.listProjects(),

  'projects.add': ({ url }) => store.addProject(url),

  'projects.open': async ({ projectId }) => {
    const project = await store.getProject(projectId)
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`)
    if (!project.cloned)
      throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`)
    const [{ head, files }, targeting] = await Promise.all([
      git.workingTree(projectId),
      store.getLastTargeting(projectId)
    ])
    void indexer.open(projectId, projectRepoDir(projectId), files, head)
    return { project, head, targeting }
  },

  'projects.setTargeting': ({ projectId, targeting }) =>
    store.setLastTargeting(projectId, targeting),

  'projects.remove': async ({ projectId }) => {
    await indexer.close(projectId)
    await store.removeProject(projectId)
  },

  'clone.start': async ({ projectId }) => {
    const project = await store.getProject(projectId)
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`)
    // Node treats an unhandled promise rejection as a crash-worthy error, so
    // this must be caught even though the result is discarded.
    void git.cloneProject(projectId, project.url).catch(() => undefined)
  }
}
