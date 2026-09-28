import { useEffect, useRef, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { X } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { IconButton } from '../../components/IconButton';
import { SectionHeading } from '../../components/SectionHeading';
import { ThemePanel } from './ThemePanel';
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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.z.modal};
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
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
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overlay = overlayRef.current;
    const first = overlay?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? overlay)?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  function focusables(): HTMLElement[] {
    return Array.from(overlayRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    e.stopPropagation();
    if (e.key === 'Escape') {
      // A native <select>'s own open dropdown consumes Escape to close
      // itself; that keydown still bubbles and must not also close the overlay.
      if ((e.target as HTMLElement).tagName === 'SELECT') return;
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <Overlay
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
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
          <ExtensionsPanel />
        </Page>
      </OverlayBody>
    </Overlay>
  );
}
