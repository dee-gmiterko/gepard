import { useEffect, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { IconButton } from './IconButton';
import { CHEVRON_SLOT_WIDTH, ChevronSlot, FileRow, FolderRow, TreeLabel } from './treeStyles';
import { listReset } from './List';
import type { TreeNode } from '../helpers/tree';

const messages = defineMessages({
  collapse: {
    id: 'components.tree.collapse',
    defaultMessage: 'Collapse',
  },
  expand: {
    id: 'components.tree.expand',
    defaultMessage: 'Expand',
  },
});

export interface TreeProps<T> {
  nodes: TreeNode<T>[];
  selectedPath?: string | null;
  isSelected?: (node: TreeNode<T>) => boolean;
  onSelectFile?: (node: TreeNode<T>) => void;
  onEnterFile?: (node: TreeNode<T>) => void;
  renderFile: (node: TreeNode<T>) => ReactNode;
  renderFolder?: (node: TreeNode<T>) => ReactNode;
}

const List = styled.ul`
  ${listReset}
`;

const RootRow = styled(FolderRow)`
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

function onRowKeyDown(onActivate: () => void): (e: React.KeyboardEvent) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onActivate();
  };
}

const ChevronButton = styled(IconButton)`
  width: ${CHEVRON_SLOT_WIDTH}px;
  height: ${CHEVRON_SLOT_WIDTH}px;
`;

export function Chevron({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <ChevronSlot>
      <ChevronButton
        icon={expanded ? ChevronDown : ChevronRight}
        label={intl.formatMessage(expanded ? messages.collapse : messages.expand)}
        size={12}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      />
    </ChevronSlot>
  );
}

export function Tree<T>({
  nodes,
  selectedPath,
  isSelected,
  onSelectFile,
  onEnterFile,
  renderFile,
  renderFolder,
}: TreeProps<T>): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    scrolled.current = false;
  }, [selectedPath]);

  // The selected row may not exist or be visible yet (rows still loading, a
  // hidden tab), so keep trying on later renders until it has been scrolled to.
  useEffect(() => {
    if (scrolled.current) return;
    const row = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row?.checkVisibility()) return;
    row.scrollIntoView({ block: 'nearest' });
    scrolled.current = true;
  });

  function toggle(path: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function onFileRowKeyDown(node: TreeNode<T>): (e: React.KeyboardEvent) => void {
    return (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (onEnterFile ?? onSelectFile)?.(node);
      } else if (e.key === ' ') {
        e.preventDefault();
        onSelectFile?.(node);
      }
    };
  }

  function renderNodes(list: TreeNode<T>[], depth: number): ReactNode {
    return list.map((node) => {
      const hasChildren = node.children.length > 0;
      const expanded = !collapsed.has(node.path);
      if (node.isFolder) {
        const Folder = node.path === '' ? RootRow : FolderRow;
        return (
          <li key={node.path} role="none">
            <Folder
              role="treeitem"
              tabIndex={0}
              aria-expanded={expanded}
              $depth={depth}
              onClick={() => toggle(node.path)}
              onKeyDown={onRowKeyDown(() => toggle(node.path))}
            >
              <Chevron expanded={expanded} onToggle={() => toggle(node.path)} />
              <TreeLabel title={node.path || node.name}>{node.name}</TreeLabel>
              {renderFolder?.(node)}
            </Folder>
            {expanded && <List role="group">{renderNodes(node.children, depth + 1)}</List>}
          </li>
        );
      }
      const selected = isSelected ? isSelected(node) : node.path === selectedPath;
      return (
        <li key={node.path} role="none">
          <FileRow
            role="treeitem"
            tabIndex={0}
            $depth={depth}
            $selected={selected}
            aria-selected={selected}
            aria-expanded={hasChildren ? expanded : undefined}
            onClick={() => onSelectFile?.(node)}
            onKeyDown={onFileRowKeyDown(node)}
          >
            {hasChildren ? (
              <Chevron expanded={expanded} onToggle={() => toggle(node.path)} />
            ) : (
              <ChevronSlot aria-hidden="true" />
            )}
            {renderFile(node)}
          </FileRow>
          {hasChildren && expanded && (
            <List role="group">{renderNodes(node.children, depth + 1)}</List>
          )}
        </li>
      );
    });
  }

  return (
    <List ref={listRef} role="tree">
      {renderNodes(nodes, 0)}
    </List>
  );
}
