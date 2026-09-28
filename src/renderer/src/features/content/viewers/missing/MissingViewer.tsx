import { defineMessages, FormattedMessage } from 'react-intl';
import { Message } from '../../../../components/Message';

const messages = defineMessages({
  notAvailable: {
    id: 'content.missingViewer.notAvailable',
    defaultMessage: '{path} is not available here',
  },
  noFileSelected: {
    id: 'content.missingViewer.noFileSelected',
    defaultMessage: 'No file selected',
  },
});

export function MissingViewer({ path }: { path: string | null }): React.JSX.Element {
  return (
    <Message tone="subtle" layout="center">
      {path ? (
        <FormattedMessage {...messages.notAvailable} values={{ path }} />
      ) : (
        <FormattedMessage {...messages.noFileSelected} />
      )}
    </Message>
  );
}
