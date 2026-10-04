import { useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { Server } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { LanguageServerState } from '@gepard/common';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useLanguageServers } from '../../queries/projects';
import { IconButton } from '../../components/IconButton';
import { Badge, type BadgeTone } from '../../components/Badge';
import { Surface } from '../../components/Surface';

const messages = defineMessages({
  title: {
    id: 'sidePanel.languageServers.title',
    defaultMessage: 'Language servers',
  },
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

const Anchor = styled.div`
  position: relative;
`;

const Popup = styled(Surface)`
  position: absolute;
  left: calc(100% + ${({ theme }) => theme.space[1]});
  bottom: 0;
  z-index: ${({ theme }) => theme.z.popover};
  width: max-content;
  max-width: 420px;
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
`;

const Title = styled.div`
  margin-bottom: ${({ theme }) => theme.space[1]};
  font-weight: 600;
`;

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

function LanguageServersList(): React.JSX.Element {
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

export function LanguageServersButton(): React.JSX.Element {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  useOutsideClick(anchorRef, () => setOpen(false));

  return (
    <Anchor
      ref={anchorRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <IconButton
        icon={Server}
        label={intl.formatMessage(messages.title)}
        active={open}
        aria-pressed={undefined}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <Popup id={popupId} role="dialog" aria-label={intl.formatMessage(messages.title)}>
          <Title>
            <FormattedMessage {...messages.title} />
          </Title>
          <LanguageServersList />
        </Popup>
      )}
    </Anchor>
  );
}
