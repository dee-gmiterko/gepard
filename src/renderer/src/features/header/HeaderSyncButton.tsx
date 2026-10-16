import styled, { css } from 'styled-components';
import { RefreshCw } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '../../components/Badge';
import { spinningAnimation } from '../../components/controlStyles';
import { IconButton } from '../../components/IconButton';
import { useFullSync } from '../../queries/comments';
import { useTargetPr } from '../../state/hooks';

const messages = defineMessages({
  refresh: {
    id: 'header.syncButton.refresh',
    defaultMessage: 'Refresh',
  },
  refreshWithCount: {
    id: 'header.syncButton.refreshWithCount',
    defaultMessage: 'Refresh ({count} to sync)',
  },
  countOverflow: {
    id: 'header.syncButton.countOverflow',
    defaultMessage: '{max}+',
  },
});

const MAX_BADGE_COUNT = 99;

const Wrap = styled.span<{ $spinning: boolean }>`
  position: relative;
  display: inline-flex;

  ${({ $spinning }) =>
    $spinning &&
    css`
      svg {
        ${spinningAnimation}
      }
    `}
`;

const CountBadge = styled(Badge)`
  position: absolute;
  top: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.bg};
  border-color: transparent;
  font-size: 9px;
  line-height: 1.3;
  pointer-events: none;
`;

export function HeaderSyncButton(): React.JSX.Element | null {
  const intl = useIntl();
  const pr = useTargetPr();
  const { sync, syncing, pendingCount } = useFullSync();

  if (pr === null) return null;

  const label = pendingCount
    ? intl.formatMessage(messages.refreshWithCount, { count: pendingCount })
    : intl.formatMessage(messages.refresh);

  return (
    <Wrap $spinning={syncing}>
      <IconButton icon={RefreshCw} label={label} disabled={syncing} onClick={sync} />
      {pendingCount ? (
        <CountBadge aria-hidden="true">
          {pendingCount > MAX_BADGE_COUNT
            ? intl.formatMessage(messages.countOverflow, { max: MAX_BADGE_COUNT })
            : intl.formatNumber(pendingCount)}
        </CountBadge>
      ) : null}
    </Wrap>
  );
}
