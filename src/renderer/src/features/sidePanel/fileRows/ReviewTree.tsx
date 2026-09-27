import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { Tree, TreeLabel, type TreeNode } from '../../../components/Tree'
import { FileRowMarks } from './FileRowMarks'
import type { RowData } from './rowData'

function changedLeaves(node: TreeNode<RowData>): string[] {
  if (!node.isFolder) return (node.data?.totalCount ?? 0) > 0 ? [node.path] : []
  return node.children.flatMap(changedLeaves)
}

export function ReviewTree({
  nodes,
  pr
}: {
  nodes: TreeNode<RowData>[]
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
