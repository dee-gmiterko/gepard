import { defineMessages, FormattedMessage } from 'react-intl';
import { useFileDiff } from '../../../../queries/files';
import { Message } from '../../../../components/Message';
import { BinaryDiffViewer } from '../binary/BinaryDiffViewer';
import { ImageDiffViewer } from '../imageDiff/ImageDiffViewer';
import { MissingViewer } from '../missing/MissingViewer';
import { DiffCodeViewer } from './DiffCodeViewer';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
  renamedWithoutChanges: {
    id: 'content.diffViewer.renamedWithoutChanges',
    defaultMessage: 'File renamed without changes.',
  },
  renamedPaths: {
    id: 'content.diffViewer.renamedPaths',
    defaultMessage: '{previousPath} → {path}',
  },
  noContentChanges: {
    id: 'content.diffViewer.noContentChanges',
    defaultMessage: 'No content changes.',
  },
});

export function DiffViewer({ path }: { path: string }): React.JSX.Element {
  const { data } = useFileDiff(path);

  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />;
    case 'binary':
      return (
        <BinaryDiffViewer
          path={path}
          previousPath={data.previousPath}
          oldSize={data.oldSize}
          newSize={data.newSize}
        />
      );
    case 'image':
      return <ImageDiffViewer path={path} before={data.before} after={data.after} />;
    case 'text':
      if (data.rows.length === 0)
        return (
          <Message layout="center">
            {data.previousPath ? (
              <>
                <FormattedMessage {...messages.renamedWithoutChanges} />
                {'\n'}
                <FormattedMessage
                  {...messages.renamedPaths}
                  values={{ previousPath: data.previousPath, path }}
                />
              </>
            ) : (
              <FormattedMessage {...messages.noContentChanges} />
            )}
          </Message>
        );
      return <DiffCodeViewer path={path} rows={data.rows} />;
  }
}
