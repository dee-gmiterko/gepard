import { AppError } from '@gepard/common';
import type { HandlerMap } from '../registry';
import * as store from '../../store/projects';
import type { GhService } from '../../services/gh';
import type { GitService } from '../../services/git';
import { indexer } from '../../lsp/indexer';

export function createProjectsHandlers(
  gh: GhService,
  git: GitService,
): Pick<
  HandlerMap,
  | 'app.viewer'
  | 'app.viewerRepos'
  | 'projects.list'
  | 'projects.add'
  | 'projects.setTargeting'
  | 'projects.setLayout'
  | 'projects.remove'
  | 'projects.fetch'
  | 'clone.start'
> {
  return {
    'app.viewer': () => gh.viewer(),

    'app.viewerRepos': () => gh.listViewerRepos(),

    'projects.list': () => store.listProjects(),

    'projects.add': ({ url }) => store.addProject(url),

    'projects.setTargeting': ({ projectId, targeting }) =>
      store.setLastTargeting(projectId, targeting),

    'projects.setLayout': ({ projectId, layout }) => store.setLayout(projectId, layout),

    'projects.remove': async ({ projectId }) => {
      await indexer.close(projectId);
      await store.removeProject(projectId);
    },

    'projects.fetch': async ({ projectId }) => {
      const project = await store.getProject(projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
      if (!project.cloned)
        throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`);
      await git.fetchOrigin(projectId);
    },

    'clone.start': async ({ projectId }) => {
      const project = await store.getProject(projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
      git.cloneProject(projectId, project.url).catch(() => undefined);
    },
  };
}
