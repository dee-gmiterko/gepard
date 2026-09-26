// The side panel's file list with the spec's "File in sidebar" rows: name,
// +/- counts, viewed checkbox; folders show sums and their checkbox applies
// to every changed file under them that this tab shows. Used by the file
// browser and the targeted browser.
import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { Tree, TreeLabel, type TreeNode } from '../../../components/Tree'
import { FileRowMarks } from './FileRowMarks'
import type { RowData } from './rowData'

/** Only changed files can be marked viewed. */
function changedLeaves(node: TreeNode<RowData>): string[] {
  if (!node.isFolder) return (node.data?.totalCount ?? 0) > 0 ? [node.path] : []
  return node.children.flatMap(changedLeaves)
}

export function ReviewTree({
  nodes,
  pr
}: {
  nodes: TreeNode<RowData>[]
  /** Viewed checkboxes only exist while a PR is targeted. */
  pr: number | null
}): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()

  return (
    <Tree<RowData>
      nodes={nodes}
      selectedPath={state.activeFile}
      onSelectFile={(node) => dispatch({ type: 'file/open', path: node.path })}
      renderFile={(node) => (
        <>
          <TreeLabel title={node.path}>{node.name}</TreeLabel>
          {node.data && <FileRowMarks data={node.data} paths={[node.path]} pr={pr} />}
        </>
      )}
      renderFolder={(node) =>
        node.data ? <FileRowMarks data={node.data} paths={changedLeaves(node)} pr={pr} /> : null
      }
    />
  )
}
