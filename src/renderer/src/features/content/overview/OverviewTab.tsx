import { useOverviewPr } from '../../../state/hooks';
import { PrOverview } from './pr/PrOverview';
import { ProjectOverview } from './project/ProjectOverview';

export function OverviewTab(): React.JSX.Element {
  const pr = useOverviewPr();
  return pr === null ? <ProjectOverview /> : <PrOverview />;
}
