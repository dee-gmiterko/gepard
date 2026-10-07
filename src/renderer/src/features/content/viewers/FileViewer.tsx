import { defineMessages, FormattedMessage } from 'react-intl';
import { useCheckout, useLayout } from '../../../state/hooks';
import { useCurrentHead } from '../../../queries/projects';
import { useChangedFiles } from '../../../queries/files';
import { useIsCheckedOutChangedFile } from '../useIsCheckedOutChangedFile';
import { CodeViewer } from './code/CodeViewer';
import { DiffViewer } from './diff/DiffViewer';
import { FullFileDiffViewer } from './code/FullFileDiffViewer';
import { Message } from '../../../components/Message';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
});

export function FileViewer({ path }: { path: string }): React.JSX.Element {
  const layout = useLayout();
  const checkout = useCheckout();
  const head = useCurrentHead();
  const { data: changedFiles } = useChangedFiles();
  const isChangedFile = useIsCheckedOutChangedFile(path);

  if (checkout) {
    if (!changedFiles)
      return (
        <Message layout="center">
          <FormattedMessage {...messages.loading} />
        </Message>
      );
    const changeType = changedFiles.find(
      (f) => f.path === path || f.previousPath === path,
    )?.changeType;
    if (isChangedFile && changeType !== 'ADDED')
      return layout.fullFileDiff ? <FullFileDiffViewer path={path} /> : <DiffViewer path={path} />;
    return <CodeViewer path={path} />;
  }

  if (!head)
    return (
      <Message layout="center">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  return <CodeViewer path={path} />;
}
