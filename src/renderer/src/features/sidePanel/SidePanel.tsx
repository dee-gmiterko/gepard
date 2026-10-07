import { useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { FileText, Layers, Search, Settings } from 'react-feather';
import { defineMessages, useIntl, type IntlShape, type MessageDescriptor } from 'react-intl';
import { useAppDispatch } from '../../state/AppContext';
import { useLayout, useSidePanelFocusRequest, useSidePanelTab } from '../../state/hooks';
import type { SidePanelTab } from '../../state/reducer';
import { useSetLayout } from '../../queries/projects';
import { IconButton } from '../../components/IconButton';
import { ResizablePanel } from '../../components/ResizablePanel';
import { FileTree } from './fileTree/FileTree';
import { TargetedBrowser } from './targeted/TargetedBrowser';
import { SearchPanel } from './search/SearchPanel';
import { LanguageServersButton } from './LanguageServersButton';

const MIN_WIDTH = 220;
const MAX_WIDTH = 640;

const messages = defineMessages({
  tablist: {
    id: 'sidePanel.tablist',
    defaultMessage: 'Side panel',
  },
  files: {
    id: 'sidePanel.tabs.files',
    defaultMessage: 'File browser',
  },
  targeted: {
    id: 'sidePanel.tabs.targeted',
    defaultMessage: 'Targeted files',
  },
  search: {
    id: 'sidePanel.tabs.search',
    defaultMessage: 'Search',
  },
  openSettings: {
    id: 'sidePanel.openSettings',
    defaultMessage: 'Settings',
  },
});

function tabId(id: SidePanelTab): string {
  return `sidePanel-tab-${id}`;
}

function panelId(id: SidePanelTab): string {
  return `sidePanel-panel-${id}`;
}

const Panel = styled(ResizablePanel)`
  position: relative;
  display: grid;
  grid-template-columns: 32px 1fr;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSubtle};
`;

const TabRail = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding-top: ${({ theme }) => theme.space[2]};
  padding-bottom: ${({ theme }) => theme.space[2]};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`;

const TabList = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`;

const TabRailSpacer = styled.div`
  flex: 1;
`;

const TabContent = styled.div`
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  overflow: auto;

  &[hidden] {
    display: none;
  }
`;

const TABS: {
  id: SidePanelTab;
  label: MessageDescriptor;
  icon: typeof FileText;
}[] = [
  { id: 'files', label: messages.files, icon: FileText },
  { id: 'targeted', label: messages.targeted, icon: Layers },
  { id: 'search', label: messages.search, icon: Search },
];

export function SidePanel(): React.JSX.Element {
  const intl: IntlShape = useIntl();
  const layout = useLayout();
  const sidePanelFocusRequest = useSidePanelFocusRequest();
  const sidePanelTab = useSidePanelTab();
  const dispatch = useAppDispatch();
  const setLayout = useSetLayout();

  const searchPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sidePanelFocusRequest === 0 || sidePanelTab !== 'search') return;
    searchPanelRef.current?.querySelector('input')?.focus();
  }, [sidePanelFocusRequest, sidePanelTab]);

  const commitWidth = useCallback(
    (value: number) => {
      dispatch({ type: 'layout/setSidePanelWidth', width: value });
      setLayout.mutate({ ...layout, sidePanelWidth: value });
    },
    [dispatch, setLayout, layout],
  );

  return (
    <Panel
      width={layout.sidePanelWidth}
      min={MIN_WIDTH}
      max={MAX_WIDTH}
      edge="right"
      onCommit={commitWidth}
    >
      <TabRail>
        <TabList role="tablist" aria-label={intl.formatMessage(messages.tablist)}>
          {TABS.map((tab) => {
            const selected = sidePanelTab === tab.id;
            return (
              <IconButton
                key={tab.id}
                id={tabId(tab.id)}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(tab.id)}
                icon={tab.icon}
                label={intl.formatMessage(tab.label)}
                active={selected}
                onClick={() => dispatch({ type: 'sidePanel/setTab', tab: tab.id, focus: true })}
              />
            );
          })}
        </TabList>
        <TabRailSpacer />
        <LanguageServersButton />
        <IconButton
          icon={Settings}
          label={intl.formatMessage(messages.openSettings)}
          onClick={() => dispatch({ type: 'settings/setOpen', open: true })}
        />
      </TabRail>
      <TabContent
        id={panelId('files')}
        role="tabpanel"
        aria-labelledby={tabId('files')}
        hidden={sidePanelTab !== 'files'}
      >
        <FileTree />
      </TabContent>
      <TabContent
        id={panelId('targeted')}
        role="tabpanel"
        aria-labelledby={tabId('targeted')}
        hidden={sidePanelTab !== 'targeted'}
      >
        <TargetedBrowser />
      </TabContent>
      <TabContent
        ref={searchPanelRef}
        id={panelId('search')}
        role="tabpanel"
        aria-labelledby={tabId('search')}
        hidden={sidePanelTab !== 'search'}
      >
        <SearchPanel />
      </TabContent>
    </Panel>
  );
}
