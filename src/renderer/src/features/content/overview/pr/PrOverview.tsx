import { usePrSummary } from '../../../../queries/prs';
import { useOverviewPr } from '../../../../state/hooks';
import { usePrOverviewDetails } from '../../../../queries/overview';
import styled from 'styled-components';
import { Stack } from '../../../../components/Layout';
import { Page, PageBody } from '../shared/overviewStyles';
import { DescriptionPanel } from './DescriptionPanel';
import { FileBreakdown } from './FileBreakdown';
import { GitTreePanel } from './GitTreePanel';
import { PrFacts } from './PrFacts';
import { PrHeader } from './PrHeader';
import { ReviewersPanel } from './ReviewersPanel';
import { TimelinePanel } from './TimelinePanel';

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: ${({ theme }) => theme.space[5]};
  align-items: start;

  @container overview (max-width: 860px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export function PrOverview(): React.JSX.Element {
  const prQuery = usePrSummary(useOverviewPr());
  const detailsQuery = usePrOverviewDetails();

  return (
    <Page>
      <PageBody>
        <PrHeader prQuery={prQuery} detailsQuery={detailsQuery} />
        <PrFacts prQuery={prQuery} />
        <Columns>
          <Stack $gap={5}>
            <DescriptionPanel detailsQuery={detailsQuery} />
            <GitTreePanel prQuery={prQuery} />
            <TimelinePanel prQuery={prQuery} detailsQuery={detailsQuery} />
          </Stack>
          <Stack $gap={5}>
            <ReviewersPanel detailsQuery={detailsQuery} />
            <FileBreakdown />
          </Stack>
        </Columns>
      </PageBody>
    </Page>
  );
}
