import { useAppDispatch, useAppStore } from '../../../state/AppContext';
import { useActiveFile } from '../../../state/hooks';
import { canMarkViewed } from '../../../state/reducer';
import { Tree } from '../../../components/Tree';
import { TreeLabel } from '../../../components/treeStyles';
import type { TreeNode } from '../../../helpers/tree';
import { FileRowMarks } from './FileRowMarks';
import { changedLeaves, type RowData } from '../../../helpers/row';

export function ReviewTree({ nodes }: { nodes: TreeNode<RowData>[] }): React.JSX.Element {
  const activeFile = useActiveFile();
  const dispatch = useAppDispatch();
  const store = useAppStore();

  return (
    <Tree<RowData>
      nodes={nodes}
      selectedPath={activeFile}
      onSelectFile={(node) => dispatch({ type: 'file/open', path: node.path })}
      onEnterFile={(node) => {
        if (canMarkViewed(store.getState(), node.path)) {
          dispatch({ type: 'viewed/toggle', path: node.path });
        } else {
          dispatch({ type: 'file/open', path: node.path });
        }
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
