import { useTargetedPr } from '../../../../queries/prs';
import { usePrOverviewDetails } from '../../../../queries/overview';
import { Page, PageBody } from '../shared/overviewStyles';
import { DescriptionPanel } from './DescriptionPanel';
import { FileBreakdown } from './FileBreakdown';
import { PrFacts } from './PrFacts';
import { PrHeader } from './PrHeader';
import { ReviewersPanel } from './ReviewersPanel';
import { TimelinePanel } from './TimelinePanel';

export function PrOverview(): React.JSX.Element {
  const prQuery = useTargetedPr();
  const detailsQuery = usePrOverviewDetails();

  return (
    <Page>
      <PageBody>
        <PrHeader prQuery={prQuery} detailsQuery={detailsQuery} />
        <PrFacts prQuery={prQuery} />
        <FileBreakdown />
        <ReviewersPanel detailsQuery={detailsQuery} />
        <TimelinePanel prQuery={prQuery} detailsQuery={detailsQuery} />
        <DescriptionPanel detailsQuery={detailsQuery} />
      </PageBody>
    </Page>
  );
}
