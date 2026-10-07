import { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useAppDispatch } from '../../../state/AppContext';
import { useActiveFile } from '../../../state/hooks';
import { Caption } from '../../../components/Caption';
import { Message } from '../../../components/Message';
import type { ViewMode } from '../../../components/ViewModeToggle';
import { MatchLine } from '../../../components/MatchLine';
import { Chevron } from '../../../components/Tree';
import { ChevronSlot, FileRow, FolderRow, TreeLabel } from '../../../components/treeStyles';
import { VirtualList } from '../../../components/VirtualList';
import { focusVisible } from '../../../components/controlStyles';
import { FileRowMarks } from '../fileRows/FileRowMarks';
import { useRowData } from '../../../queries/review';
import { buildSearchRows, type FileMatches, type SearchRow } from '../../../helpers/search';

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

const RowButton = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: ${({ theme }) => theme.space[1]};
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  ${focusVisible}
`;

export function SearchResults({
  files,
  mode,
  initiallyExpanded,
  hasMore,
  onLoadMore,
}: {
  files: readonly FileMatches[];
  mode: ViewMode;
  initiallyExpanded: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const activeFile = useActiveFile();
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
          aria-level={row.depth + 1}
          aria-expanded={expanded}
          $depth={row.depth}
        >
          <Chevron expanded={expanded} onToggle={() => toggle(row.path)} />
          <RowButton type="button" onClick={() => toggle(row.path)}>
            <TreeLabel title={row.path}>{row.name}</TreeLabel>
          </RowButton>
        </FolderRow>
      );
    }

    if (row.kind === 'file') {
      const expanded = isExpanded(row.path);
      return (
        <FileRow
          role="treeitem"
          aria-level={row.depth + 1}
          aria-expanded={expanded}
          aria-selected={false}
          $depth={row.depth}
          $selected={false}
        >
          <Chevron expanded={expanded} onToggle={() => toggle(row.path)} />
          <RowButton type="button" onClick={() => open(row)}>
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
          </RowButton>
          <FileRowMarks data={rowFor(row.path)} paths={[row.path]} />
        </FileRow>
      );
    }

    const selected = row.filePath === activeFile;
    return (
      <FileRow
        role="treeitem"
        aria-level={row.depth + 1}
        aria-selected={selected}
        $depth={row.depth}
        $selected={selected}
      >
        <ChevronSlot aria-hidden="true" />
        <RowButton type="button" onClick={() => open(row)}>
          <MatchLine line={row.match.line} preview={row.match.preview} spans={row.match.spans} />
        </RowButton>
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
