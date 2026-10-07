import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useCurrentHead, useOpenedProject } from '../../../queries/projects';
import { useTree } from '../../../queries/files';
import { buildTree, withRoot } from '../../../helpers/tree';
import { Message } from '../../../components/Message';
import { ReviewTree } from '../fileRows/ReviewTree';

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
  const rootName = useOpenedProject().data?.project.repo ?? '';

  const nodes = useMemo(() => {
    const entries = buildTree(paths ?? []);
    return entries.length > 0 ? withRoot(entries, rootName) : entries;
  }, [paths, rootName]);

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
