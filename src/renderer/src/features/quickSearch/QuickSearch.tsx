import { useQuickSearchMode } from '../../state/hooks';
import { QuickSearchPopup } from './QuickSearchPopup';

export function QuickSearch(): React.JSX.Element | null {
  const mode = useQuickSearchMode();
  if (mode === null) return null;
  return <QuickSearchPopup key={mode} mode={mode} />;
}
