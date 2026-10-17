import { useContextMenu } from '../../state/hooks';
import { ContextMenuPopup } from './ContextMenuPopup';
import { useContextMenuTrigger } from './useContextMenuTrigger';

export function ContextMenu(): React.JSX.Element | null {
  useContextMenuTrigger();
  const menu = useContextMenu();
  if (menu === null) return null;
  return <ContextMenuPopup menu={menu} />;
}
