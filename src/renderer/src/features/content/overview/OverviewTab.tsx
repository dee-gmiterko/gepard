import { useAppState } from '../../../state/AppContext';
import { PrOverview } from './pr/PrOverview';
import { ProjectOverview } from './project/ProjectOverview';

export function OverviewTab(): React.JSX.Element {
  const pr = useAppState().targeting.pr;
  return pr === null ? <ProjectOverview /> : <PrOverview />;
}
