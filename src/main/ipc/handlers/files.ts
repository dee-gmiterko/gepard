import type { HandlerMap } from '../registry'
import * as git from '../../services/git'

export const filesHandlers: Pick<
  HandlerMap,
  'files.changed' | 'files.diff' | 'files.content' | 'trees.get'
> = {
  'files.changed': ({ projectId, base, head }) => git.changedFiles(projectId, base, head),
  'files.diff': ({ projectId, base, head, path }) => git.fileDiff(projectId, base, head, path),
  'files.content': ({ projectId, sha, path }) => git.fileContentAt(projectId, sha, path),
  'trees.get': ({ projectId, sha }) => git.listTree(projectId, sha)
}
