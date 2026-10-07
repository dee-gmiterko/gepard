import { defineMessages, FormattedMessage } from 'react-intl';
import { Badge } from '../../../../components/Badge';

const messages = defineMessages({
  fork: { id: 'content.overview.forkBadge', defaultMessage: 'Fork' },
});

export function ForkBadge({ head }: { head: string }): React.JSX.Element {
  return (
    <Badge $tone="warning" title={head}>
      <FormattedMessage {...messages.fork} />
    </Badge>
  );
}
