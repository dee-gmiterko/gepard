import { defineMessages, FormattedMessage } from 'react-intl';
import { BinaryFacts } from './BinaryFacts';
import { BinaryFact } from './BinaryFact';
import { BinaryFactSize } from './BinaryFactSize';

const messages = defineMessages({
  title: {
    id: 'content.binaryViewer.title',
    defaultMessage: 'Binary file',
  },
  size: {
    id: 'content.binaryViewer.size',
    defaultMessage: 'Size',
  },
});

export function BinaryViewer({ path, size }: { path: string; size?: number }): React.JSX.Element {
  return (
    <BinaryFacts title={<FormattedMessage {...messages.title} />} path={path}>
      {size !== undefined && (
        <BinaryFact label={<FormattedMessage {...messages.size} />}>
          <BinaryFactSize bytes={size} />
        </BinaryFact>
      )}
    </BinaryFacts>
  );
}
