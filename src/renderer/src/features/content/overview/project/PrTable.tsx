import { defineMessages, FormattedMessage } from 'react-intl';
import type { OverviewPr } from '@gepard/common';
import { HeaderCell, PR_COLUMNS, RowGrid, Table } from '../shared/overviewStyles';
import { PrRow } from './PrRow';

const messages = defineMessages({
  pr: { id: 'content.overview.project.pr', defaultMessage: 'Pull request' },
  size: { id: 'content.overview.project.size', defaultMessage: 'Size' },
  comments: { id: 'content.overview.project.comments', defaultMessage: 'Comments' },
  decision: { id: 'content.overview.project.decision', defaultMessage: 'Decision' },
  progress: { id: 'content.overview.project.progress', defaultMessage: 'Viewed' },
  updated: { id: 'content.overview.project.updated', defaultMessage: 'Updated' },
});

const HEADERS = ['pr', 'size', 'comments', 'decision', 'progress', 'updated'] as const;

export function PrTable({ prs }: { prs: readonly OverviewPr[] }): React.JSX.Element {
  return (
    <Table>
      <RowGrid $columns={PR_COLUMNS} $head>
        {HEADERS.map((key) => (
          <HeaderCell key={key}>
            <FormattedMessage {...messages[key]} />
          </HeaderCell>
        ))}
        <span />
      </RowGrid>
      {prs.map((pr) => (
        <PrRow key={pr.number} pr={pr} />
      ))}
    </Table>
  );
}
