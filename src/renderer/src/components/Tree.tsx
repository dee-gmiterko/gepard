import { useMemo, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { IconButton } from './IconButton';
import {
  CHEVRON_SLOT_WIDTH,
  ChevronSlot,
  FileRow,
  FolderRow,
  TREE_ROW_HEIGHT,
  TreeLabel,
} from './treeStyles';
import { VirtualList } from './VirtualList';
import { flattenVisible, type TreeNode } from '../helpers/tree';

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

const Root = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const RootRow = styled(FolderRow)`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ChevronButton = styled(IconButton)`
  width: ${CHEVRON_SLOT_WIDTH}px;
  height: ${CHEVRON_SLOT_WIDTH}px;
`;

export function Chevron({
  expanded,
  onToggle,
  tabIndex,
}: {
  expanded: boolean;
  onToggle: () => void;
  tabIndex?: number;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <ChevronSlot>
      <ChevronButton
        icon={expanded ? ChevronDown : ChevronRight}
        label={intl.formatMessage(expanded ? messages.collapse : messages.expand)}
        size={12}
        tabIndex={tabIndex}
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
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const rows = useMemo(() => flattenVisible(nodes, collapsed), [nodes, collapsed]);

  const selectedIndex = rows.findIndex(({ node }) =>
    node.isFolder ? false : isSelected ? isSelected(node) : node.path === selectedPath,
  );
  const scrollTo = useMemo(
    () =>
      selectedIndex >= 0
        ? { key: `selected:${selectedPath ?? ''}`, index: selectedIndex }
        : undefined,
    [selectedIndex, selectedPath],
  );

  const focusedIndex = rows.findIndex(({ node }) => node.path === focusedPath);
  const tabbableIndex = focusedIndex >= 0 ? focusedIndex : Math.max(0, selectedIndex);

  function toggle(path: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function moveTo(index: number): void {
    const target = rows.at(index);
    if (!target) return;
    pendingFocus.current = target.node.path;
    setFocusedPath(target.node.path);
  }

  function onRowKeyDown(index: number): (e: React.KeyboardEvent) => void {
    return (e) => {
      const { node, parentIndex } = rows[index];
      const expandable = node.children.length > 0;
      const expanded = !collapsed.has(node.path);
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (index + 1 < rows.length) moveTo(index + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (index > 0) moveTo(index - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!expandable) break;
          if (!expanded) toggle(node.path);
          else moveTo(index + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (expandable && expanded) toggle(node.path);
          else if (parentIndex >= 0) moveTo(parentIndex);
          break;
        case 'Enter':
          e.preventDefault();
          if (node.isFolder) toggle(node.path);
          else (onEnterFile ?? onSelectFile)?.(node);
          break;
        case ' ':
          e.preventDefault();
          if (node.isFolder) toggle(node.path);
          else onSelectFile?.(node);
          break;
      }
    };
  }

  function renderRow(index: number): ReactNode {
    const { node, depth, position, setSize } = rows[index];
    const expandable = node.children.length > 0;
    const expanded = !collapsed.has(node.path);
    const common = {
      role: 'treeitem',
      tabIndex: index === tabbableIndex ? 0 : -1,
      'aria-level': depth + 1,
      'aria-posinset': position,
      'aria-setsize': setSize,
      'aria-expanded': expandable ? expanded : undefined,
      $depth: depth,
      onFocus: () => setFocusedPath(node.path),
      onKeyDown: onRowKeyDown(index),
      ref: (el: HTMLDivElement | null) => {
        if (el && pendingFocus.current === node.path) {
          pendingFocus.current = null;
          el.focus();
        }
      },
    };
    if (node.isFolder) {
      const Folder = node.path === '' ? RootRow : FolderRow;
      return (
        <Folder {...common} onClick={() => toggle(node.path)}>
          <Chevron expanded={expanded} tabIndex={-1} onToggle={() => toggle(node.path)} />
          <TreeLabel title={node.path || node.name}>{node.name}</TreeLabel>
          {renderFolder?.(node)}
        </Folder>
      );
    }
    const selected = isSelected ? isSelected(node) : node.path === selectedPath;
    return (
      <FileRow
        {...common}
        $selected={selected}
        aria-selected={selected}
        onClick={() => onSelectFile?.(node)}
      >
        {expandable ? (
          <Chevron expanded={expanded} tabIndex={-1} onToggle={() => toggle(node.path)} />
        ) : (
          <ChevronSlot aria-hidden="true" />
        )}
        {renderFile(node)}
      </FileRow>
    );
  }

  return (
    <Root>
      <VirtualList
        role="tree"
        rowCount={rows.length}
        rowHeight={TREE_ROW_HEIGHT}
        getKey={(i) => rows[i].node.path}
        renderRow={renderRow}
        scrollTo={scrollTo}
      />
    </Root>
  );
}
