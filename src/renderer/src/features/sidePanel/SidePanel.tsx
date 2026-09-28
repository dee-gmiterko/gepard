import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { FileText, Layers, Search, Settings } from 'react-feather'
import { useIntl, type IntlShape, type MessageDescriptor } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import type { SidePanelTab } from '../../state/reducer'
import { useSetLayout } from '../../queries/projects'
import { useResizeHandle } from '../../hooks/useResizeHandle'
import { IconButton } from '../../components/IconButton'
import { ResizeHandle } from '../../components/ResizeHandle'
import { FileTree } from './fileTree/FileTree'
import { TargetedBrowser } from './targeted/TargetedBrowser'
import { SearchPanel } from './search/SearchPanel'

const MIN_WIDTH = 220
const MAX_WIDTH = 640

const messages = defineMessages({
  tablist: {
    id: 'sidePanel.tablist',
    defaultMessage: 'Side panel'
  },
  files: {
    id: 'sidePanel.tabs.files',
    defaultMessage: 'File browser'
  },
  targeted: {
    id: 'sidePanel.tabs.targeted',
    defaultMessage: 'Targeted files'
  },
  search: {
    id: 'sidePanel.tabs.search',
    defaultMessage: 'Search'
  },
  openSettings: {
    id: 'sidePanel.openSettings',
    defaultMessage: 'Settings'
  }
})

function tabId(id: SidePanelTab): string {
  return `sidePanel-tab-${id}`
}

function panelId(id: SidePanelTab): string {
  return `sidePanel-panel-${id}`
}

const Panel = styled.div<{ $width: number }>`
  position: relative;
  display: grid;
  grid-template-columns: 32px 1fr;
  grid-template-rows: minmax(0, 1fr);
  width: ${({ $width }) => $width}px;
  min-height: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSubtle};
`

const Handle = styled(ResizeHandle)`
  right: -3px;
`

const TabRail = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: ${({ theme }) => theme.space[2]};
  padding-bottom: ${({ theme }) => theme.space[2]};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`

const TabList = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`

const TabRailSpacer = styled.div`
  flex: 1;
`

const TabContent = styled.div`
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  overflow: auto;

  &[hidden] {
    display: none;
  }
`

const TABS: {
  id: SidePanelTab
  label: MessageDescriptor
  icon: typeof FileText
}[] = [
  { id: 'files', label: messages.files, icon: FileText },
  { id: 'targeted', label: messages.targeted, icon: Layers },
  { id: 'search', label: messages.search, icon: Search }
]

export function SidePanel(): React.JSX.Element {
  const intl: IntlShape = useIntl()
  const state = useAppState()
  const dispatch = useAppDispatch()
  const setLayout = useSetLayout()

  const [width, setWidth] = useState(state.layout.sidePanelWidth)
  const draggingRef = useRef(false)
  useEffect(() => {
    if (!draggingRef.current) setWidth(state.layout.sidePanelWidth)
  }, [state.layout.sidePanelWidth])

  const { onPointerDown } = useResizeHandle({
    min: MIN_WIDTH,
    max: MAX_WIDTH,
    sign: 1,
    getValue: () => width,
    onChange: (value) => {
      draggingRef.current = true
      setWidth(value)
    },
    onCommit: (value) => {
      draggingRef.current = false
      dispatch({ type: 'layout/setSidePanelWidth', width: value })
      setLayout.mutate({ ...state.layout, sidePanelWidth: value })
    }
  })

  return (
    <Panel $width={width}>
      <Handle onPointerDown={onPointerDown} />
      <TabRail>
        <TabList role="tablist" aria-label={intl.formatMessage(messages.tablist)}>
          {TABS.map((tab) => {
            const selected = state.sidePanelTab === tab.id
            return (
              <IconButton
                key={tab.id}
                id={tabId(tab.id)}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(tab.id)}
                tabIndex={selected ? 0 : -1}
                icon={tab.icon}
                label={intl.formatMessage(tab.label)}
                active={selected}
                onClick={() => dispatch({ type: 'sidePanel/setTab', tab: tab.id })}
              />
            )
          })}
        </TabList>
        <TabRailSpacer />
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
        hidden={state.sidePanelTab !== 'files'}
      >
        <FileTree />
      </TabContent>
      <TabContent
        id={panelId('targeted')}
        role="tabpanel"
        aria-labelledby={tabId('targeted')}
        hidden={state.sidePanelTab !== 'targeted'}
      >
        <TargetedBrowser />
      </TabContent>
      <TabContent
        id={panelId('search')}
        role="tabpanel"
        aria-labelledby={tabId('search')}
        hidden={state.sidePanelTab !== 'search'}
      >
        <SearchPanel />
      </TabContent>
    </Panel>
  )
}
