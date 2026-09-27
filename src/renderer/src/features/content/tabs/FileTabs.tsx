import { Bookmark, MessageSquare, X } from 'react-feather'
import styled from 'styled-components'
import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { openTabs } from '../../../state/selectors'
import { IconButton } from '../../../components/IconButton'
import { Ellipsis } from '../../../components/Ellipsis'

const TabStrip = styled.div`
  display: flex;
  align-items: stretch;
  height: 32px;
  overflow-x: auto;
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Tab = styled.button<{ $active: boolean; $preview: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  flex: 0 0 auto;
  padding: 0 ${({ theme }) => theme.space[2]};
  border: none;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $active }) => ($active ? theme.colors.bg : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.fg : theme.colors.fgMuted)};
  font-style: ${({ $preview }) => ($preview ? 'italic' : 'normal')};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: ${({ theme, $active }) => (!$active ? theme.colors.bgHover : theme.colors.bg)};
  }
`

const Label = styled(Ellipsis)`
  max-width: 200px;
`

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export function FileTabs(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const tabs = openTabs(state)

  return (
    <TabStrip>
      <Tab
        type="button"
        $active={state.mainTab === 'comments'}
        $preview={false}
        title="All comments"
        onClick={() => dispatch({ type: 'mainTab/set', tab: 'comments' })}
      >
        <MessageSquare size={12} />
        <Label>Comments</Label>
      </Tab>
      {tabs.map((path) => {
        const isPinned = state.pinnedFiles.includes(path)
        const isActive = state.mainTab === 'files' && state.activeFile === path
        return (
          <Tab
            key={path}
            type="button"
            $active={isActive}
            $preview={!isPinned}
            title={path}
            onClick={() => dispatch({ type: 'file/focus', path })}
            onDoubleClick={() => {
              if (!isPinned) dispatch({ type: 'file/pin', path })
            }}
          >
            <Label>{basename(path)}</Label>
            {isPinned ? (
              <IconButton
                icon={X}
                size={12}
                label={`Close ${path}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'file/unpin', path })
                }}
              />
            ) : (
              <IconButton
                icon={Bookmark}
                size={12}
                label={`Pin ${path}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'file/pin', path })
                }}
              />
            )}
          </Tab>
        )
      })}
    </TabStrip>
  )
}
