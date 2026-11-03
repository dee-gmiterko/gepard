import { useMemo, type UIEvent } from 'react';
import { defineMessages, FormattedDate, FormattedMessage } from 'react-intl';
import styled, { useTheme } from 'styled-components';
import type { UseQueryResult } from '@tanstack/react-query';
import { prHeadLabel, type PrSummary } from '@gepard/common';
import { Caption } from '../../../../components/Caption';
import { Surface } from '../../../../components/Surface';
import { useCommitGraph, usePrCommitList } from '../../../../queries/prs';
import { useOverviewPr } from '../../../../state/hooks';
import { layoutGraph, type GraphRow } from '../../../../helpers/gitGraph';
import { Panel } from '../shared/Panel';
import { PanelBody } from '../shared/PanelBody';
import { LinkButton } from '../shared/overviewStyles';
import { useOverviewActions } from '../shared/useOverviewActions';

const messages = defineMessages({
  title: { id: 'content.overview.pr.gitTree', defaultMessage: 'Commits' },
  loadingMore: {
    id: 'content.overview.pr.gitTree.loadingMore',
    defaultMessage: 'Loading earlier commits…',
  },
});

const DOT_RADIUS = 4;
const LANE_WIDTH = 16;
const ROW_HEIGHT = 28;
const LABEL_WIDTH = 140;
const SHORT_SHA_LENGTH = 7;
const LOAD_MORE_THRESHOLD_PX = 120;

const Scroll = styled(Surface).attrs({ $elevation: 'flat' })`
  max-height: 320px;
  overflow: auto;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
`;

const Rows = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Row = styled.li<{ $railWidth: number }>`
  display: grid;
  grid-template-columns: ${LABEL_WIDTH}px ${({ $railWidth }) => $railWidth}px minmax(0, 1fr);
  align-items: center;
  height: ${ROW_HEIGHT}px;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Rail = styled.svg`
  display: block;
  overflow: visible;
`;

const Heads = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space[1]};
  min-width: 0;
  overflow: hidden;
  padding-right: ${({ theme }) => theme.space[2]};
`;

const Head = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  padding: 0 ${({ theme }) => theme.space[2]};
  border: 1px solid ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Body = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: baseline;
  min-width: 0;
`;

const Headline = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Sha = styled(Caption)`
  font-family: ${({ theme }) => theme.font.mono};
`;

const laneX = (lane: number): number => lane * LANE_WIDTH + LANE_WIDTH / 2;

function TreeRow({
  row,
  laneCount,
  inPr,
  labels,
}: {
  row: GraphRow;
  laneCount: number;
  inPr: boolean;
  labels: string[];
}): React.JSX.Element {
  const actions = useOverviewActions();
  const theme = useTheme();
  const palette = [
    theme.colors.accent,
    theme.colors.success,
    theme.colors.warning,
    theme.colors.danger,
    theme.colors.fgSubtle,
  ];
  const colorOf = (lane: number): string => palette[lane % palette.length];
  const { commit, lane } = row;
  const mid = ROW_HEIGHT / 2;
  const x = laneX(lane);
  const width = laneCount * LANE_WIDTH;
  return (
    <Row $railWidth={width}>
      <Heads>
        {labels.map((label) => (
          <Head key={label} title={label}>
            {label}
          </Head>
        ))}
      </Heads>
      <Rail width={width} height={ROW_HEIGHT} aria-hidden>
        {row.passing.map((i) => (
          <line
            key={`p${i}`}
            x1={laneX(i)}
            y1={0}
            x2={laneX(i)}
            y2={ROW_HEIGHT}
            stroke={colorOf(i)}
          />
        ))}
        {row.incoming.map((i) => (
          <line key={`i${i}`} x1={laneX(i)} y1={0} x2={x} y2={mid} stroke={colorOf(i)} />
        ))}
        {row.outgoing.map((o) => (
          <line key={`o${o}`} x1={x} y1={mid} x2={laneX(o)} y2={ROW_HEIGHT} stroke={colorOf(o)} />
        ))}
        <circle
          cx={x}
          cy={mid}
          r={DOT_RADIUS}
          fill={inPr ? colorOf(lane) : theme.colors.bg}
          stroke={colorOf(lane)}
          strokeWidth={2}
        />
      </Rail>
      <Body>
        <Headline title={commit.messageHeadline}>
          <LinkButton onClick={() => actions.openCommit(commit.oid)}>
            {commit.messageHeadline}
          </LinkButton>
        </Headline>
        <Caption>{commit.authorName}</Caption>
        <Sha>{commit.oid.slice(0, SHORT_SHA_LENGTH)}</Sha>
        <Caption>
          <FormattedDate value={commit.committedDate} dateStyle="medium" />
        </Caption>
      </Body>
    </Row>
  );
}

export function GitTreePanel({
  prQuery,
}: {
  prQuery: UseQueryResult<PrSummary>;
}): React.JSX.Element {
  const prNumber = useOverviewPr();
  const commitsQuery = usePrCommitList(prNumber);
  const graphQuery = useCommitGraph(prNumber);
  const pr = prQuery.data;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = graphQuery;

  const commits = useMemo(
    () => graphQuery.data?.pages.flatMap((p) => p.commits) ?? [],
    [graphQuery.data],
  );
  const layout = useMemo(() => layoutGraph(commits, !hasNextPage), [commits, hasNextPage]);
  const prOids = useMemo(
    () => new Set((commitsQuery.data ?? []).map((c) => c.oid)),
    [commitsQuery.data],
  );
  const headLabel = pr ? prHeadLabel(pr) : null;

  const onScroll = (e: UIEvent<HTMLElement>): void => {
    const el = e.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < LOAD_MORE_THRESHOLD_PX && hasNextPage && !isFetchingNextPage)
      void fetchNextPage();
  };

  const labelsOf = (row: GraphRow): string[] =>
    pr && headLabel && row.commit.oid === pr.headRefOid && !row.commit.refs.includes(headLabel)
      ? [headLabel, ...row.commit.refs]
      : row.commit.refs;

  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <PanelBody
        isPending={prQuery.isPending || graphQuery.isPending}
        error={graphQuery.error}
        rows={3}
      >
        <Scroll onScroll={onScroll}>
          <Rows>
            {layout.rows.map((row) => (
              <TreeRow
                key={row.commit.oid}
                row={row}
                laneCount={layout.laneCount}
                inPr={prOids.has(row.commit.oid)}
                labels={labelsOf(row)}
              />
            ))}
          </Rows>
          {isFetchingNextPage && (
            <Caption>
              <FormattedMessage {...messages.loadingMore} />
            </Caption>
          )}
        </Scroll>
      </PanelBody>
    </Panel>
  );
}
