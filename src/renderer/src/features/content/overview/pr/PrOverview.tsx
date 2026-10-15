import { useTargetedPrQuery } from '../../../../queries/prs';
import { usePrOverviewDetails } from '../../../../queries/overview';
import { Page, PageBody } from '../shared/overviewStyles';
import { DescriptionPanel } from './DescriptionPanel';
import { FileBreakdown } from './FileBreakdown';
import { PrFacts } from './PrFacts';
import { PrHeader } from './PrHeader';
import { ReviewersPanel } from './ReviewersPanel';
import { TimelinePanel } from './TimelinePanel';

export function PrOverview(): React.JSX.Element {
  const prQuery = useTargetedPrQuery();
  const pr = prQuery.data ?? null;
  const details = usePrOverviewDetails();

  return (
    <Page>
      <PageBody>
        <PrHeader
          pr={pr}
          prError={prQuery.error}
          details={details.data}
          isLoadingDetails={details.isLoading}
          detailsError={details.error}
        />
        <PrFacts pr={pr} />
        <FileBreakdown />
        <ReviewersPanel details={details.data} error={details.error} />
        <TimelinePanel pr={pr} details={details.data} />
        <DescriptionPanel body={details.data?.body} error={details.error} />
      </PageBody>
    </Page>
  );
}
