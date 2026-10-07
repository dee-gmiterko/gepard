import { useTargetPr } from '../../../state/hooks';
import { PrOverview } from './pr/PrOverview';
import { ProjectOverview } from './project/ProjectOverview';

export function OverviewTab(): React.JSX.Element {
  const pr = useTargetPr();
  return pr === null ? <ProjectOverview /> : <PrOverview />;
}
