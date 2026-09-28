import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useCurrentHead } from '../../../queries/projects';
import { useTree } from '../../../queries/files';
import { buildTree } from '../../../components/Tree';
import { Message } from '../../../components/Message';
import { ReviewTree } from '../fileRows/ReviewTree';
import { aggregateRows, useRowData } from '../fileRows/rowData';

const messages = defineMessages({
  opening: {
    id: 'sidePanel.fileTree.opening',
    defaultMessage: 'Opening project…',
  },
  loading: {
    id: 'sidePanel.fileTree.loading',
    defaultMessage: 'Loading files…',
  },
  empty: {
    id: 'sidePanel.fileTree.empty',
    defaultMessage: 'No files.',
  },
});

export function FileTree(): React.JSX.Element {
  const head = useCurrentHead();
  const { data: paths, isLoading } = useTree();
  const { rowFor } = useRowData();

  const nodes = useMemo(
    () =>
      buildTree(
        (paths ?? []).map((path) => ({ path, data: rowFor(path) })),
        { aggregateFolder: aggregateRows },
      ),
    [paths, rowFor],
  );

  if (!head)
    return (
      <Message>
        <FormattedMessage {...messages.opening} />
      </Message>
    );
  if (isLoading)
    return (
      <Message>
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  if (nodes.length === 0)
    return (
      <Message>
        <FormattedMessage {...messages.empty} />
      </Message>
    );

  return <ReviewTree nodes={nodes} />;
}
