import { defineMessages, FormattedMessage } from 'react-intl';
import { useCheckoutHead, useLayout } from '../../../state/hooks';
import { useCurrentHead } from '../../../queries/projects';
import { useChangedFiles } from '../../../queries/files';
import { useIsCheckedOutChangedFile } from '../../../queries/review';
import { CodeViewer } from './code/CodeViewer';
import { DiffViewer } from './diff/DiffViewer';
import { FullFileDiffViewer } from './code/FullFileDiffViewer';
import { MarkdownViewer } from './markdown/MarkdownViewer';
import { isMarkdownPath } from '../../../components/markdown';
import { Message } from '../../../components/Message';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
});

export function FileViewer({ path }: { path: string }): React.JSX.Element {
  const layout = useLayout();
  const checkoutHead = useCheckoutHead();
  const head = useCurrentHead();
  const { data: changedFiles } = useChangedFiles();
  const isChangedFile = useIsCheckedOutChangedFile(path);

  if (checkoutHead) {
    if (!changedFiles)
      return (
        <Message layout="center">
          <FormattedMessage {...messages.loading} />
        </Message>
      );
    const changeType = changedFiles.find(
      (f) => f.path === path || f.previousPath === path,
    )?.changeType;
    const preview = layout.markdownPreview && isMarkdownPath(path);
    const showDiff = isChangedFile && changeType !== 'ADDED' && !layout.showCurrent;
    if (preview) return <MarkdownViewer path={path} type={showDiff ? 'diff' : 'file'} />;
    if (showDiff)
      return layout.fullFileDiff ? <FullFileDiffViewer path={path} /> : <DiffViewer path={path} />;
    return <CodeViewer path={path} />;
  }

  if (!head)
    return (
      <Message layout="center">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  if (layout.markdownPreview && isMarkdownPath(path))
    return <MarkdownViewer path={path} type="file" />;
  return <CodeViewer path={path} />;
}
