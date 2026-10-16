import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { OverviewPr } from '@gepard/common';
import { HeaderCell, PR_COLUMNS, RowGrid, Table } from '../shared/overviewStyles';
import { PrRow } from './PrRow';

const messages = defineMessages({
  pr: { id: 'content.overview.project.pr', defaultMessage: 'Pull request' },
  size: { id: 'content.overview.project.size', defaultMessage: 'Size' },
  comments: { id: 'content.overview.project.comments', defaultMessage: 'Comments' },
  progress: { id: 'content.overview.project.progress', defaultMessage: 'Viewed' },
  updated: { id: 'content.overview.project.updated', defaultMessage: 'Updated' },
});

const NARROW_PR_COLUMNS = 'minmax(0, 1fr) repeat(2, auto)';

const ResponsiveTable = styled(Table)`
  @container overview (max-width: 720px) {
    grid-template-columns: ${NARROW_PR_COLUMNS};

    > * > :nth-child(n + 3):nth-child(-n + 5) {
      display: none;
    }
  }
`;

const HEADERS = ['pr', 'size', 'comments', 'progress', 'updated'] as const;

export function PrTable({ prs }: { prs: readonly OverviewPr[] }): React.JSX.Element {
  return (
    <ResponsiveTable $columns={PR_COLUMNS}>
      <RowGrid $head>
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
    </ResponsiveTable>
  );
}
