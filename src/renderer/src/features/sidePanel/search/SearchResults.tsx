import { useCallback, useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { Caption } from '../../../components/Caption';
import { Message } from '../../../components/Message';
import { MatchLine } from '../../../components/MatchLine';
import { Chevron, ChevronSlot, FileRow, FolderRow, TreeLabel } from '../../../components/Tree';
import { VirtualList } from '../../../components/VirtualList';
import { FileRowMarks } from '../fileRows/FileRowMarks';
import { useRowData } from '../fileRows/rowData';
import { buildSearchRows, type FileMatches, type SearchRow } from './searchRows';

const messages = defineMessages({
  loadingMore: {
    id: 'sidePanel.search.loadingMore',
    defaultMessage: 'Loading more…',
  },
  fileMatchCount: {
    id: 'sidePanel.search.fileMatchCount',
    defaultMessage: '{count}{more, select, true {+} other {}}',
  },
  moreMatchesInFile: {
    id: 'sidePanel.search.moreMatchesInFile',
    defaultMessage: 'This file has more matches than are shown.',
  },
});

const ROW_HEIGHT = 28;

export function SearchResults({
  files,
  mode,
  initiallyExpanded,
  hasMore,
  onLoadMore,
}: {
  files: readonly FileMatches[];
  mode: 'tree' | 'flat';
  initiallyExpanded: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rowFor } = useRowData();
  const [defaultExpanded] = useState(initiallyExpanded);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  const isExpanded = useCallback(
    (path: string) => overrides.get(path) ?? defaultExpanded,
    [overrides, defaultExpanded],
  );
  const rows = useMemo(() => buildSearchRows(files, mode, isExpanded), [files, mode, isExpanded]);

  function toggle(path: string): void {
    setOverrides((prev) => new Map(prev).set(path, !(prev.get(path) ?? defaultExpanded)));
  }

  function open(row: SearchRow): void {
    if (row.kind === 'match') {
      dispatch({ type: 'file/open', path: row.filePath, line: row.match.line });
    } else if (row.kind === 'file') {
      dispatch({ type: 'file/open', path: row.path });
    }
  }

  function onKeyDown(activate: () => void): (e: React.KeyboardEvent) => void {
    return (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      activate();
    };
  }

  function renderRow(index: number): React.ReactNode {
    if (index >= rows.length) {
      return (
        <Message>
          <FormattedMessage {...messages.loadingMore} />
        </Message>
      );
    }
    const row = rows[index];

    if (row.kind === 'folder') {
      const expanded = isExpanded(row.path);
      return (
        <FolderRow
          role="treeitem"
          tabIndex={0}
          aria-level={row.depth + 1}
          aria-expanded={expanded}
          $depth={row.depth}
          onClick={() => toggle(row.path)}
          onKeyDown={onKeyDown(() => toggle(row.path))}
        >
          <Chevron expanded={expanded} onToggle={() => toggle(row.path)} />
          <TreeLabel title={row.path}>{row.name}</TreeLabel>
        </FolderRow>
      );
    }

    if (row.kind === 'file') {
      const expanded = isExpanded(row.path);
      return (
        <FileRow
          role="treeitem"
          tabIndex={0}
          aria-level={row.depth + 1}
          aria-expanded={expanded}
          aria-selected={false}
          $depth={row.depth}
          $selected={false}
          onClick={() => open(row)}
          onKeyDown={onKeyDown(() => open(row))}
        >
          <Chevron expanded={expanded} onToggle={() => toggle(row.path)} />
          <TreeLabel title={row.path}>{row.name}</TreeLabel>
          <Caption
            title={
              row.file.moreMatches ? intl.formatMessage(messages.moreMatchesInFile) : undefined
            }
          >
            {intl.formatMessage(messages.fileMatchCount, {
              count: row.file.matches.length,
              more: String(row.file.moreMatches),
            })}
          </Caption>
          <FileRowMarks data={rowFor(row.path)} paths={[row.path]} />
        </FileRow>
      );
    }

    const selected = row.filePath === state.activeFile;
    return (
      <FileRow
        role="treeitem"
        tabIndex={0}
        aria-level={row.depth + 1}
        aria-selected={selected}
        $depth={row.depth}
        $selected={selected}
        onClick={() => open(row)}
        onKeyDown={onKeyDown(() => open(row))}
      >
        <ChevronSlot aria-hidden="true" />
        <MatchLine line={row.match.line} preview={row.match.preview} spans={row.match.spans} />
      </FileRow>
    );
  }

  return (
    <VirtualList
      role="tree"
      rowCount={rows.length + (hasMore ? 1 : 0)}
      rowHeight={ROW_HEIGHT}
      getKey={(i) => (i < rows.length ? rows[i].key : 'loading-more')}
      renderRow={renderRow}
      onNearEnd={hasMore ? onLoadMore : undefined}
    />
  );
}
