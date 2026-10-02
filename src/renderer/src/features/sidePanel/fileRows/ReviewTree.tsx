import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { useCommands } from '../../../keyboard/useCommands';
import { Tree, TreeLabel } from '../../../components/Tree';
import type { TreeNode } from '../../../helpers/tree';
import { FileRowMarks } from './FileRowMarks';
import { changedLeaves, type RowData } from '../../../helpers/row';

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
