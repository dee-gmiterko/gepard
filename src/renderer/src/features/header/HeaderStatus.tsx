import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { WifiOff } from 'react-feather';
import { useHeaderStatus } from './useHeaderStatus';
import { Ellipsis } from '../../components/Ellipsis';
import { ProgressBar } from '../../components/ProgressBar';
import { useIndexStatus } from '../../queries/projects';
import { useOffline } from '../../queries/connectivity';
import { useReviewProgress } from '../../queries/review';

const messages = defineMessages({
  checkingOut: {
    id: 'header.checkingOut',
    defaultMessage: 'Checking out…',
  },
  indexing: {
    id: 'header.indexing',
    defaultMessage: 'Indexing…',
  },
  progress: {
    id: 'header.progress',
    defaultMessage: '{viewed} / {total} viewed',
  },
  offline: {
    id: 'header.offline',
    defaultMessage: 'Offline',
  },
  offlineHint: {
    id: 'header.offlineHint',
    defaultMessage: 'GitHub could not be reached. Changes stay local until the connection returns.',
  },
});

const Root = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  min-width: 0;
`;

const Review = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  margin-left: auto;
`;

const Status = styled(Ellipsis)`
  flex: none;
  width: 90px;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};

  @container header (max-width: 760px) {
    display: none;
  }
`;

const Offline = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.warning};
  white-space: nowrap;
`;

const Progress = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
  white-space: nowrap;

  @container header (max-width: 960px) {
    > :last-child {
      display: none;
    }
  }
`;

interface HeaderStatusProps {
  pending: boolean;
}

export function HeaderStatus({ pending }: HeaderStatusProps): React.JSX.Element {
  const intl = useIntl();
  const headerStatus = useHeaderStatus();
  const offline = useOffline();
  const progress = useReviewProgress();
  const { data: index } = useIndexStatus();

  return (
    <Root>
      {pending && (
        <Status>
          <FormattedMessage {...messages.checkingOut} />
        </Status>
      )}
      {headerStatus && (
        <Status>
          <FormattedMessage {...headerStatus.message} />
        </Status>
      )}
      <Review>
        {offline && (
          <Offline role="status" title={intl.formatMessage(messages.offlineHint)}>
            <WifiOff size={14} />
            <FormattedMessage {...messages.offline} />
          </Offline>
        )}
        {progress.totalCount > 0 && (
          <Progress>
            <FormattedMessage
              {...messages.progress}
              values={{ viewed: progress.viewedCount, total: progress.totalCount }}
            />
            <ProgressBar
              value={progress.viewedCount}
              max={progress.totalCount}
              tone="muted"
              width="80px"
              label={intl.formatMessage(messages.progress, {
                viewed: progress.viewedCount,
                total: progress.totalCount,
              })}
            />
          </Progress>
        )}
        {index?.state === 'indexing' && (
          <Status>
            <FormattedMessage {...messages.indexing} />
          </Status>
        )}
      </Review>
    </Root>
  );
}
