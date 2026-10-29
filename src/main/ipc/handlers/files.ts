import type { HandlerMap } from '../dispatch';
import type { GitService } from '../../services/git';
import type { HiddenFilesFilter } from '../../services/hiddenFiles';

export class FilesHandlers {
  constructor(
    private readonly git: GitService,
    private readonly hidden: HiddenFilesFilter,
  ) {}

  toHandlerMap(): Pick<HandlerMap, 'files.changed' | 'files.diff' | 'files.content' | 'trees.get'> {
    return {
      'files.changed': async ({ projectId, base, head }) =>
        this.hidden.filter(
          projectId,
          await this.git.changedFiles(projectId, base, head),
          (file) => file.path,
        ),
      'files.diff': ({ projectId, base, head, path }) =>
        this.git.fileDiff(projectId, base, head, path),
      'files.content': ({ projectId, sha, path }) => this.git.fileContentAt(projectId, sha, path),
      'trees.get': async ({ projectId, sha }) =>
        this.hidden.filter(projectId, await this.git.listTree(projectId, sha), (path) => path),
    };
  }
}
