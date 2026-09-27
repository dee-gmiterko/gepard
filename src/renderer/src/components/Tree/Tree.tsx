import { useEffect, useRef, useState, type ReactNode } from 'react'
import styled from 'styled-components'
import { ChevronDown, ChevronRight } from 'react-feather'
import { useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { IconButton, focusVisible } from '../IconButton'
import { listReset } from '../List'
import type { TreeNode } from './buildTree'
import { TreeLabel } from './TreeLabel'

const messages = defineMessages({
  collapse: {
    id: 'components.tree.collapse',
    defaultMessage: 'Collapse'
  },
  expand: {
    id: 'components.tree.expand',
    defaultMessage: 'Expand'
  }
})

export interface TreeProps<T> {
  nodes: TreeNode<T>[]
  selectedPath?: string | null
  isSelected?: (node: TreeNode<T>) => boolean
  onSelectFile?: (node: TreeNode<T>) => void
  renderFile: (node: TreeNode<T>) => ReactNode
  renderFolder?: (node: TreeNode<T>) => ReactNode
}

const List = styled.ul`
  ${listReset}
`

const Row = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  min-height: 24px;
  padding: 2px ${({ theme }) => theme.space[2]} 2px
    calc(${({ theme }) => theme.space[2]} + ${({ $depth }) => $depth * 14}px);

  ${focusVisible}
`

const FileRow = styled(Row)<{ $selected: boolean }>`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ $selected, theme }) => ($selected ? theme.colors.bgSelected : 'transparent')};

  &:hover {
    background: ${({ $selected, theme }) => ($selected ? theme.colors.bgSelected : theme.colors.bgHover)};
  }
`

const FolderRow = styled(Row)`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.fgMuted};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`

function onRowKeyDown(onActivate: () => void): (e: React.KeyboardEvent) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onActivate()
  }
}

function Chevron({
  expanded,
  onToggle
}: {
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  const intl = useIntl()
  return (
    <IconButton
      icon={expanded ? ChevronDown : ChevronRight}
      label={intl.formatMessage(expanded ? messages.collapse : messages.expand)}
      size={12}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    />
  )
}

export function Tree<T>({
  nodes,
  selectedPath,
  isSelected,
  onSelectFile,
  renderFile,
  renderFolder
}: TreeProps<T>): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  function toggle(path: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function renderNodes(list: TreeNode<T>[], depth: number): ReactNode {
    return list.map((node) => {
      if (node.isFolder) {
        const expanded = !collapsed.has(node.path)
        return (
          <li key={node.path} role="none">
            <FolderRow
              role="treeitem"
              tabIndex={0}
              aria-expanded={expanded}
              $depth={depth}
              onClick={() => toggle(node.path)}
              onKeyDown={onRowKeyDown(() => toggle(node.path))}
            >
              <Chevron expanded={expanded} onToggle={() => toggle(node.path)} />
              <TreeLabel title={node.path}>{node.name}</TreeLabel>
              {renderFolder?.(node)}
            </FolderRow>
            {expanded && <List role="group">{renderNodes(node.children, depth + 1)}</List>}
          </li>
        )
      }
      const selected = isSelected ? isSelected(node) : node.path === selectedPath
      return (
        <li key={node.path} role="none">
          <FileRow
            role="treeitem"
            tabIndex={0}
            $depth={depth}
            $selected={selected}
            aria-selected={selected}
            onClick={() => onSelectFile?.(node)}
            onKeyDown={onRowKeyDown(() => onSelectFile?.(node))}
          >
            {renderFile(node)}
          </FileRow>
        </li>
      )
    })
  }

  return (
    <List ref={listRef} role="tree">
      {renderNodes(nodes, 0)}
    </List>
  )
}
