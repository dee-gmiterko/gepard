import styled from 'styled-components'
import { FileText, Layers, Search } from 'react-feather'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import type { SidePanelTab } from '../../state/reducer'
import { IconButton } from '../../components/IconButton'
import { FileTree } from './fileTree/FileTree'
import { TargetedBrowser } from './targeted/TargetedBrowser'
import { SearchPanel } from './search/SearchPanel'

const Panel = styled.div`
  display: grid;
  grid-template-columns: 32px 1fr;
  grid-template-rows: minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSubtle};
`

const TabRail = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding-top: ${({ theme }) => theme.space[2]};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`

const TabContent = styled.div`
  grid-column: 2;
  grid-row: 1;
  min-width: 240px;
  overflow: auto;

  &[hidden] {
    display: none;
  }
`

const TABS: { id: SidePanelTab; label: string; icon: typeof FileText }[] = [
  { id: 'files', label: 'File browser', icon: FileText },
  { id: 'targeted', label: 'Targeted files', icon: Layers },
  { id: 'search', label: 'Search', icon: Search }
]

export function SidePanel(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()

  return (
    <Panel>
      <TabRail>
        {TABS.map((tab) => (
          <IconButton
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={state.sidePanelTab === tab.id}
            onClick={() => dispatch({ type: 'sidePanel/setTab', tab: tab.id })}
          />
        ))}
      </TabRail>
      <TabContent hidden={state.sidePanelTab !== 'files'}>
        <FileTree />
      </TabContent>
      <TabContent hidden={state.sidePanelTab !== 'targeted'}>
        <TargetedBrowser />
      </TabContent>
      <TabContent hidden={state.sidePanelTab !== 'search'}>
        <SearchPanel />
      </TabContent>
    </Panel>
  )
}
