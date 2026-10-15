import styled, { css } from 'styled-components';
import { RefreshCw } from 'react-feather';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useFullSync } from '../../../queries/comments';
import { Button } from '../../../components/Button';
import { spinningAnimation } from '../../../components/controlStyles';

const messages = defineMessages({
  sync: {
    id: 'content.syncButton.sync',
    defaultMessage: 'Sync',
  },
  syncWithCount: {
    id: 'content.syncButton.syncWithCount',
    defaultMessage: 'Sync <b>+{count}</b>',
  },
});

const Spinning = styled(RefreshCw)<{ $spinning: boolean }>`
  ${({ $spinning }) =>
    $spinning &&
    css`
      ${spinningAnimation}
    `}
`;

export function SyncButton({ block = false }: { block?: boolean }): React.JSX.Element {
  const { sync, syncing, pendingCount } = useFullSync();

  return (
    <Button block={block} disabled={syncing} onClick={sync}>
      <Spinning size={14} $spinning={syncing} />
      {pendingCount ? (
        <FormattedMessage
          {...messages.syncWithCount}
          values={{ count: pendingCount, b: (chunks) => <strong>{chunks}</strong> }}
        />
      ) : (
        <FormattedMessage {...messages.sync} />
      )}
    </Button>
  );
}
