import { useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { Server } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { IconButton } from '../../components/IconButton';
import { Surface } from '../../components/Surface';
import { LanguageServersList } from './LanguageServersList';

const messages = defineMessages({
  title: {
    id: 'sidePanel.languageServers.title',
    defaultMessage: 'Language servers',
  },
});

const Anchor = styled.div`
  position: relative;
`;

const Popup = styled(Surface)`
  position: absolute;
  left: calc(100% + ${({ theme }) => theme.space[1]});
  bottom: 0;
  z-index: ${({ theme }) => theme.z.popover};
  width: max-content;
  min-width: 240px;
  max-width: 420px;
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
`;

const Title = styled.div`
  margin-bottom: ${({ theme }) => theme.space[1]};
  font-weight: 600;
`;

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
