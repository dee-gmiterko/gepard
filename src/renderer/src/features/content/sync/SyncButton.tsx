import styled, { css, keyframes } from 'styled-components';
import { RefreshCw } from 'react-feather';
import { defineMessages, FormattedMessage } from 'react-intl';
import { usePendingCount, useSync } from '../../../queries/comments';
import { Button } from '../../../components/Button';

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

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const Spinning = styled(RefreshCw)<{ $spinning: boolean }>`
  ${({ $spinning }) =>
    $spinning &&
    css`
      animation: ${spin} 0.8s linear infinite;
    `}
`;

export function SyncButton({ block = false }: { block?: boolean }): React.JSX.Element {
  const { mutate: runSync, isPending: syncing } = useSync();
  const { data: pendingCount } = usePendingCount();

  return (
    <Button block={block} disabled={syncing} onClick={() => runSync('full')}>
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
