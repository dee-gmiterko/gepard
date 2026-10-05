import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { LanguageServerState } from '@gepard/common';
import { useLanguageServers } from '../../queries/projects';
import { Badge, type BadgeTone } from '../../components/Badge';

const messages = defineMessages({
  loading: {
    id: 'sidePanel.languageServers.loading',
    defaultMessage: 'Loading…',
  },
  empty: {
    id: 'sidePanel.languageServers.empty',
    defaultMessage: 'No language servers installed.',
  },
  absent: {
    id: 'sidePanel.languageServers.state.absent',
    defaultMessage: 'No matching files in this project',
  },
  starting: {
    id: 'sidePanel.languageServers.state.starting',
    defaultMessage: 'starting',
  },
  active: {
    id: 'sidePanel.languageServers.state.active',
    defaultMessage: 'active',
  },
  failed: {
    id: 'sidePanel.languageServers.state.failed',
    defaultMessage: 'failed',
  },
});

const STATE_LABEL: Record<Exclude<LanguageServerState, 'absent'>, MessageDescriptor> = {
  starting: messages.starting,
  active: messages.active,
  failed: messages.failed,
};

const STATE_TONE: Record<Exclude<LanguageServerState, 'absent'>, BadgeTone> = {
  starting: 'muted',
  active: 'success',
  failed: 'danger',
};

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Item = styled.li<{ $absent: boolean }>`
  color: ${({ $absent, theme }) => ($absent ? theme.colors.fgSubtle : 'inherit')};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const Name = styled.span`
  flex: 1;
`;

const Reason = styled.div`
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  overflow-wrap: anywhere;
`;

const Muted = styled.div`
  color: ${({ theme }) => theme.colors.fgMuted};
`;

export function LanguageServersList(): React.JSX.Element {
  const intl = useIntl();
  const { data } = useLanguageServers();
  if (!data) {
    return (
      <Muted>
        <FormattedMessage {...messages.loading} />
      </Muted>
    );
  }
  if (data.length === 0) {
    return (
      <Muted>
        <FormattedMessage {...messages.empty} />
      </Muted>
    );
  }
  return (
    <List>
      {data.map((server) => (
        <Item
          key={server.id}
          $absent={server.state === 'absent'}
          title={server.state === 'absent' ? intl.formatMessage(messages.absent) : undefined}
        >
          <Row>
            <Name>{server.displayName}</Name>
            {server.state !== 'absent' && (
              <Badge $tone={STATE_TONE[server.state]}>
                <FormattedMessage {...STATE_LABEL[server.state]} />
              </Badge>
            )}
          </Row>
          {server.message && <Reason>{server.message}</Reason>}
        </Item>
      ))}
    </List>
  );
}
