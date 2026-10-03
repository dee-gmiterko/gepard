import { defineMessages, FormattedMessage } from 'react-intl';
import { Add, Del, Num } from './overviewStyles';

const messages = defineMessages({
  added: { id: 'content.overview.added', defaultMessage: '+{count}' },
  removed: { id: 'content.overview.removed', defaultMessage: '−{count}' },
});

export function Lines({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}): React.JSX.Element {
  return (
    <Num>
      <Add>
        <FormattedMessage {...messages.added} values={{ count: additions }} />
      </Add>
      <Del>
        <FormattedMessage {...messages.removed} values={{ count: deletions }} />
      </Del>
    </Num>
  );
}
