import type { HandlerMap } from '../registry';
import { AppError, emit } from '../registry';
import * as store from '../../store/projects';
import type { GhService } from '../../services/gh';
import type { GitService } from '../../services/git';
import { indexer } from '../../lsp';
import { projectRepoDir } from '../../paths';
import { log } from '../../log';

export function createProjectsHandlers(
  gh: GhService,
  git: GitService,
): Pick<
  HandlerMap,
  | 'app.viewer'
  | 'app.viewerRepos'
  | 'projects.list'
  | 'projects.add'
  | 'projects.open'
  | 'projects.setTargeting'
  | 'projects.setLayout'
  | 'projects.remove'
  | 'clone.start'
> {
  return {
    'app.viewer': () => gh.viewer(),

    'app.viewerRepos': () => gh.listViewerRepos(),

    'projects.list': () => store.listProjects(),

    'projects.add': ({ url }) => store.addProject(url),

    'projects.open': async ({ projectId }) => {
      const project = await store.getProject(projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
      if (!project.cloned)
        throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`);
      const [{ head, files }, targeting, layout] = await Promise.all([
        git.workingTree(projectId),
        store.getLastTargeting(projectId),
        store.getLayout(projectId),
      ]);
      indexer.open(projectId, projectRepoDir(projectId), files, head).catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        log.error('projects.open', `indexer failed for ${projectId}: ${message}`);
        emit('index.status', { projectId, status: { state: 'error', message } });
      });
      return { project, head, targeting, layout };
    },

    'projects.setTargeting': ({ projectId, targeting }) =>
      store.setLastTargeting(projectId, targeting),

    'projects.setLayout': ({ projectId, layout }) => store.setLayout(projectId, layout),

    'projects.remove': async ({ projectId }) => {
      await indexer.close(projectId);
      await store.removeProject(projectId);
    },

    'clone.start': async ({ projectId }) => {
      const project = await store.getProject(projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
      void git.cloneProject(projectId, project.url).catch(() => undefined);
    },
  };
}
