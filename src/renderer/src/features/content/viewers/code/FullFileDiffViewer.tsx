import { defineMessages, FormattedMessage } from 'react-intl';
import { useFileDiff } from '../../../../queries/files';
import { Message } from '../../../../components/Message';
import { DiffViewer } from '../diff/DiffViewer';
import { CodeViewer } from './CodeViewer';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
});

export function FullFileDiffViewer({ path }: { path: string }): React.JSX.Element {
  const { data } = useFileDiff(path);
  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  if (data.kind !== 'text' || data.rows.length === 0) return <DiffViewer path={path} />;
  return <CodeViewer path={path} diffRows={data.rows} />;
}
