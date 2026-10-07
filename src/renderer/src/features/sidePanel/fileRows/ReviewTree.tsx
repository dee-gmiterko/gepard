import { useUiDispatch } from '../../../state/UiContext';
import { useActiveFile } from '../../../state/hooks';
import { Tree } from '../../../components/Tree';
import { TreeLabel } from '../../../components/treeStyles';
import type { TreeNode } from '../../../helpers/tree';
import { FileRowMarks } from './FileRowMarks';
import { changedLeaves } from '../../../helpers/row';
import { useReviewActions, useRowData } from '../../../queries/review';

export function ReviewTree({ nodes }: { nodes: TreeNode<null>[] }): React.JSX.Element {
  const activeFile = useActiveFile();
  const dispatch = useUiDispatch();
  const { toggleViewed } = useReviewActions();
  const { rows, rowFor } = useRowData();

  return (
    <Tree<null>
      nodes={nodes}
      selectedPath={activeFile}
      onSelectFile={(node) => dispatch({ type: 'file/open', path: node.path })}
      onEnterFile={(node) => {
        if (!toggleViewed(node.path)) dispatch({ type: 'file/open', path: node.path });
      }}
      renderFile={(node) => (
        <>
          <TreeLabel title={node.path}>{node.name}</TreeLabel>
          <FileRowMarks data={rowFor(node.path)} paths={[node.path]} />
        </>
      )}
      renderFolder={(node) => (
        <FileRowMarks data={rowFor(node.path)} paths={changedLeaves(node, rows)} />
      )}
    />
  );
}
