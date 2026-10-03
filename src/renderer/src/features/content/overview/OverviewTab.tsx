import { useAppState } from '../../../state/AppContext';
import { PrOverview } from './PrOverview';
import { ProjectOverview } from './ProjectOverview';

export function OverviewTab(): React.JSX.Element {
  const pr = useAppState().targeting.pr;
  return pr === null ? <ProjectOverview /> : <PrOverview />;
}
