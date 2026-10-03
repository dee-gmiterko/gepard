import { defineMessages, FormattedMessage } from 'react-intl';
import { Message } from '../../../../components/Message';

const messages = defineMessages({
  loading: { id: 'content.overview.loading', defaultMessage: 'Loading…' },
  failed: { id: 'content.overview.failed', defaultMessage: 'Could not load: {message}' },
});

export function QueryState({
  isLoading,
  error,
}: {
  isLoading: boolean;
  error: Error | null;
}): React.JSX.Element | null {
  if (error) {
    return (
      <Message tone="danger" layout="inline">
        <FormattedMessage {...messages.failed} values={{ message: error.message }} />
      </Message>
    );
  }
  if (isLoading) {
    return (
      <Message layout="inline">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  }
  return null;
}
