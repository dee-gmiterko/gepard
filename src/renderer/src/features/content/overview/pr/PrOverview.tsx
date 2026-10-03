import { useTargetedPr } from '../../../../queries/prs';
import { usePrOverviewDetails } from '../../../../queries/overview';
import { QueryState } from '../shared/QueryState';
import { Page, PageBody } from '../shared/overviewStyles';
import { DescriptionPanel } from './DescriptionPanel';
import { FileBreakdown } from './FileBreakdown';
import { PrFacts } from './PrFacts';
import { PrHeader } from './PrHeader';
import { ReviewersPanel } from './ReviewersPanel';
import { TimelinePanel } from './TimelinePanel';

export function PrOverview(): React.JSX.Element {
  const pr = useTargetedPr();
  const { data: details, isLoading, error } = usePrOverviewDetails();

  if (!pr) {
    return (
      <Page>
        <QueryState isLoading error={null} />
      </Page>
    );
  }

  return (
    <Page>
      <PageBody>
        <PrHeader pr={pr} details={details} isLoading={isLoading} error={error} />
        <PrFacts pr={pr} />
        <FileBreakdown />
        {details && <ReviewersPanel details={details} />}
        <TimelinePanel pr={pr} details={details} />
        {details && <DescriptionPanel body={details.body} />}
      </PageBody>
    </Page>
  );
}
