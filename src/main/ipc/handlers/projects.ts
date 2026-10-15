import { AppError } from '@gepard/common';
import type { HandlerMap } from '../registry';
import * as store from '../../store/projects';
import type { GhService } from '../../services/gh';
import type { GitService } from '../../services/git';
import type { IndexerService } from '../../lsp/indexer';

export class ProjectsHandlers {
  constructor(
    private readonly gh: GhService,
    private readonly git: GitService,
    private readonly indexer: IndexerService,
  ) {}

  toHandlerMap(): Pick<
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
      'app.viewer': () => this.gh.viewer(),

      'app.viewerRepos': () => this.gh.listViewerRepos(),

      'projects.list': () => store.listProjects(),

      'projects.add': ({ url }) => store.addProject(url),

      'projects.setTargeting': ({ projectId, targeting }) =>
        store.setLastTargeting(projectId, targeting),

      'projects.setLayout': ({ projectId, layout }) => store.setLayout(projectId, layout),

      'projects.remove': async ({ projectId }) => {
        await this.indexer.close(projectId);
        await store.removeProject(projectId);
      },

      'projects.fetch': async ({ projectId }) => {
        const project = await store.getProject(projectId);
        if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
        if (!project.cloned)
          throw new AppError('PROJECT_NOT_CLONED', `project ${projectId} is not cloned yet`);
        await this.git.fetchOrigin(projectId);
      },

      'clone.start': async ({ projectId }) => {
        const project = await store.getProject(projectId);
        if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
        this.git.cloneProject(projectId, project.url).catch(() => undefined);
      },
    };
  }
}
