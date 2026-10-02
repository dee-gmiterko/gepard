import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { X } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { IconButton } from '../../components/IconButton';
import { SectionHeading } from '../../components/SectionHeading';
import { ThemePanel } from './ThemePanel';
import { LocalePanel } from './LocalePanel';
import { KeybindingsPanel } from './KeybindingsPanel';
import { ExtensionsPanel } from './ExtensionsPanel';

const messages = defineMessages({
  title: {
    id: 'settings.title',
    defaultMessage: 'Settings',
  },
  close: {
    id: 'settings.close',
    defaultMessage: 'Close settings',
  },
});

const Overlay = styled.dialog`
  position: fixed;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  width: 100vw;
  height: 100vh;
  max-width: none;
  max-height: none;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};

  &::backdrop {
    background: transparent;
  }
`;

const OverlayHeader = styled.div`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[5]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const OverlayBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const Page = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[5]} ${({ theme }) => theme.space[4]};
`;

export interface SettingsOverlayProps {
  onClose: () => void;
}

export function SettingsOverlay({ onClose }: SettingsOverlayProps): React.JSX.Element {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();

    // Fires on Escape (before `close`) and on programmatic close via close().
    dialog.addEventListener('close', onClose);

    return () => {
      dialog.removeEventListener('close', onClose);
      dialog.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Overlay ref={dialogRef}>
      <OverlayHeader>
        <SectionHeading
          as="h1"
          size="lg"
          title={<FormattedMessage {...messages.title} />}
          actions={
            <IconButton icon={X} label={intl.formatMessage(messages.close)} onClick={onClose} />
          }
        />
      </OverlayHeader>
      <OverlayBody>
        <Page>
          <ThemePanel />
          <LocalePanel />
          <KeybindingsPanel />
          <ExtensionsPanel />
        </Page>
      </OverlayBody>
    </Overlay>
  );
}
