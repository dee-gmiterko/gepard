import { defineMessages, FormattedMessage } from 'react-intl';
import { BinaryFacts } from './BinaryFacts';
import { BinaryFact } from './BinaryFact';
import { BinaryFactPath } from './BinaryFactPath';
import { BinaryFactSize } from './BinaryFactSize';
import { BinaryFactSizeDelta } from './BinaryFactSizeDelta';

const messages = defineMessages({
  title: {
    id: 'content.binaryDiffViewer.title',
    defaultMessage: 'Binary file changed',
  },
  previousPath: {
    id: 'content.binaryDiffViewer.previousPath',
    defaultMessage: 'Previous path',
  },
  before: {
    id: 'content.binaryDiffViewer.before',
    defaultMessage: 'Size before',
  },
  after: {
    id: 'content.binaryDiffViewer.after',
    defaultMessage: 'Size after',
  },
  sizeChange: {
    id: 'content.binaryDiffViewer.sizeChange',
    defaultMessage: 'Size change',
  },
  absent: {
    id: 'content.binaryDiffViewer.absent',
    defaultMessage: 'No file',
  },
});

export function BinaryDiffViewer({
  path,
  previousPath,
  oldSize,
  newSize,
}: {
  path: string;
  previousPath: string | null;
  oldSize?: number | null;
  newSize?: number | null;
}): React.JSX.Element {
  const sized = oldSize !== undefined && newSize !== undefined;

  return (
    <BinaryFacts title={<FormattedMessage {...messages.title} />} path={path}>
      {previousPath && (
        <BinaryFactPath
          label={<FormattedMessage {...messages.previousPath} />}
          path={previousPath}
        />
      )}
      {sized && (
        <>
          <BinaryFact label={<FormattedMessage {...messages.before} />}>
            {oldSize === null ? (
              <FormattedMessage {...messages.absent} />
            ) : (
              <BinaryFactSize bytes={oldSize} />
            )}
          </BinaryFact>
          <BinaryFact label={<FormattedMessage {...messages.after} />}>
            {newSize === null ? (
              <FormattedMessage {...messages.absent} />
            ) : (
              <BinaryFactSize bytes={newSize} />
            )}
          </BinaryFact>
          <BinaryFact label={<FormattedMessage {...messages.sizeChange} />}>
            <BinaryFactSizeDelta bytes={(newSize ?? 0) - (oldSize ?? 0)} />
          </BinaryFact>
        </>
      )}
    </BinaryFacts>
  );
}
