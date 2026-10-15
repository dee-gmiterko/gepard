import type { HandlerMap } from '../registry';
import type { GitService } from '../../services/git';

export class FilesHandlers {
  constructor(private readonly git: GitService) {}

  toHandlerMap(): Pick<HandlerMap, 'files.changed' | 'files.diff' | 'files.content' | 'trees.get'> {
    return {
      'files.changed': ({ projectId, base, head }) => this.git.changedFiles(projectId, base, head),
      'files.diff': ({ projectId, base, head, path }) =>
        this.git.fileDiff(projectId, base, head, path),
      'files.content': ({ projectId, sha, path }) => this.git.fileContentAt(projectId, sha, path),
      'trees.get': ({ projectId, sha }) => this.git.listTree(projectId, sha),
    };
  }
}
