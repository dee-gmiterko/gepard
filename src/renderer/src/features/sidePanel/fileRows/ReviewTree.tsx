import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { useCommands } from '../../../keyboard/commands';
import { Tree, TreeLabel, type TreeNode } from '../../../components/Tree';
import { FileRowMarks } from './FileRowMarks';
import type { RowData } from './rowData';

function changedLeaves(node: TreeNode<RowData>): string[] {
  if (!node.isFolder) return (node.data?.totalCount ?? 0) > 0 ? [node.path] : [];
  return node.children.flatMap(changedLeaves);
}

export function ReviewTree({ nodes }: { nodes: TreeNode<RowData>[] }): React.JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const commands = useCommands();

  return (
    <Tree<RowData>
      nodes={nodes}
      selectedPath={state.activeFile}
      onSelectFile={(node) => dispatch({ type: 'file/open', path: node.path })}
      onEnterFile={(node) => {
        if (!commands.toggleViewed(node.path)) dispatch({ type: 'file/open', path: node.path });
      }}
      renderFile={(node) => (
        <>
          <TreeLabel title={node.path}>{node.name}</TreeLabel>
          {node.data && <FileRowMarks data={node.data} paths={[node.path]} />}
        </>
      )}
      renderFolder={(node) =>
        node.data ? <FileRowMarks data={node.data} paths={changedLeaves(node)} /> : null
      }
    />
  );
}
