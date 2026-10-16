import { defineMessages, FormattedMessage } from 'react-intl';
import { BinaryFact, BinaryFactSize, BinaryFacts } from './BinaryFacts';

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
