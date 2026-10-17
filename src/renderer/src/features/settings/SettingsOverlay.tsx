import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { Command, Package, Droplet, X } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { activeToggleBackground, focusVisible } from '../../components/controlStyles';
import { IconButton } from '../../components/IconButton';
import { SectionHeading } from '../../components/SectionHeading';
import { GeneralPanel } from './GeneralPanel';
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
  tablist: {
    id: 'settings.tablist',
    defaultMessage: 'Settings sections',
  },
  tabGeneral: {
    id: 'settings.tabs.general',
    defaultMessage: 'General',
  },
  tabControls: {
    id: 'settings.tabs.controls',
    defaultMessage: 'Controls',
  },
  tabExtensions: {
    id: 'settings.tabs.extensions',
    defaultMessage: 'Extensions',
  },
});

type SettingsTab = 'general' | 'controls' | 'extensions';

const TABS: {
  id: SettingsTab;
  label: MessageDescriptor;
  icon: typeof X;
  screen: () => React.JSX.Element;
}[] = [
  { id: 'general', label: messages.tabGeneral, icon: Droplet, screen: GeneralPanel },
  { id: 'controls', label: messages.tabControls, icon: Command, screen: KeybindingsPanel },
  { id: 'extensions', label: messages.tabExtensions, icon: Package, screen: ExtensionsPanel },
];

function tabId(id: SettingsTab): string {
  return `settings-tab-${id}`;
}

function panelId(id: SettingsTab): string {
  return `settings-panel-${id}`;
}

const Overlay = styled.dialog`
  position: fixed;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  width: 100%;
  height: 100%;
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
  container: settings / inline-size;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  height: 100%;

  @container settings (max-width: 560px) {
    grid-template-columns: 48px minmax(0, 1fr);
  }
`;

const TabList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[2]};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSubtle};
  overflow: auto;
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  font: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: left;
  color: ${({ $active, theme }) => ($active ? theme.colors.fg : theme.colors.fgMuted)};
  cursor: pointer;
  ${activeToggleBackground}
  ${focusVisible}

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }

  @container settings (max-width: 560px) {
    justify-content: center;
  }
`;

const TabIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
`;

const TabLabel = styled.span`
  @container settings (max-width: 560px) {
    display: none;
  }
`;

const Screen = styled.div`
  container: settingsScreen / inline-size;
  min-width: 0;
  overflow: auto;
`;

const Page = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[5]} ${({ theme }) => theme.space[4]};
`;

export interface SettingsOverlayProps {
  onClose: () => void;
}

export function SettingsOverlay({ onClose }: SettingsOverlayProps): React.JSX.Element {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const tabsRef = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = (index + 1) % TABS.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = (index - 1 + TABS.length) % TABS.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = TABS[next].id;
    setActiveTab(target);
    tabsRef.current[target]?.focus();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = (): void => onCloseRef.current();
    dialog.showModal();

    // Fires on Escape (before `close`) and on programmatic close via close().
    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.close();
    };
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
        <Layout>
          <TabList
            role="tablist"
            aria-orientation="vertical"
            aria-label={intl.formatMessage(messages.tablist)}
            onKeyDown={handleTabKeyDown}
          >
            {TABS.map((tab) => {
              const selected = activeTab === tab.id;
              const label = intl.formatMessage(tab.label);
              return (
                <Tab
                  key={tab.id}
                  ref={(node) => {
                    tabsRef.current[tab.id] = node;
                  }}
                  type="button"
                  id={tabId(tab.id)}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId(tab.id)}
                  aria-label={label}
                  title={label}
                  tabIndex={selected ? 0 : -1}
                  $active={selected}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon>
                    <tab.icon size={16} />
                  </TabIcon>
                  <TabLabel>{label}</TabLabel>
                </Tab>
              );
            })}
          </TabList>
          {TABS.filter((tab) => tab.id === activeTab).map((tab) => (
            <Screen
              key={tab.id}
              id={panelId(tab.id)}
              role="tabpanel"
              aria-labelledby={tabId(tab.id)}
            >
              <Page>
                <tab.screen />
              </Page>
            </Screen>
          ))}
        </Layout>
      </OverlayBody>
    </Overlay>
  );
}
