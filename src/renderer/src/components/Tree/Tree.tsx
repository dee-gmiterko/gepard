import { useEffect, useRef, useState, type ReactNode } from 'react'
import styled from 'styled-components'
import { ChevronDown, ChevronRight } from 'react-feather'
import { IconButton } from '../IconButton'
import type { TreeNode } from './buildTree'
import { TreeLabel } from './TreeLabel'

export interface TreeProps<T> {
  nodes: TreeNode<T>[]
  selectedPath?: string | null
  onSelectFile?: (node: TreeNode<T>) => void
  renderFile: (node: TreeNode<T>) => ReactNode
  renderFolder?: (node: TreeNode<T>) => ReactNode
}

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`

const Row = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  min-height: 24px;
  padding: 2px ${({ theme }) => theme.space[2]} 2px
    calc(${({ theme }) => theme.space[2]} + ${({ $depth }) => $depth * 14}px);
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

function Chevron({
  expanded,
  onToggle
}: {
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <IconButton
      icon={expanded ? ChevronDown : ChevronRight}
      label={expanded ? 'Collapse' : 'Expand'}
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
          <li key={node.path}>
            <FolderRow $depth={depth} onClick={() => toggle(node.path)}>
              <Chevron expanded={expanded} onToggle={() => toggle(node.path)} />
              <TreeLabel title={node.path}>{node.name}</TreeLabel>
              {renderFolder?.(node)}
            </FolderRow>
            {expanded && <List>{renderNodes(node.children, depth + 1)}</List>}
          </li>
        )
      }
      return (
        <li key={node.path}>
          <FileRow
            $depth={depth}
            $selected={node.path === selectedPath}
            aria-selected={node.path === selectedPath}
            onClick={() => onSelectFile?.(node)}
          >
            {renderFile(node)}
          </FileRow>
        </li>
      )
    })
  }

  return <List ref={listRef}>{renderNodes(nodes, 0)}</List>
}
