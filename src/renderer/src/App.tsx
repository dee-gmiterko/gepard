import styled from 'styled-components';
import { useUiDispatch } from './state/UiContext';
import { useProjectId, useSettingsOpen } from './state/hooks';
import { useGlobalKeys } from './keyboard/useGlobalKeys';
import { useGamepadBindings } from './gamepad/useGamepadBindings';
import { useGamepadNavigation } from './gamepad/useGamepadNavigation';
import { useWindowTitle } from './hooks/useWindowTitle';
import { useContextMenuLabels } from './hooks/useContextMenuLabels';
import { Launchpad } from './features/launchpad/Launchpad';
import { Header } from './features/header/Header';
import { SidePanel } from './features/sidePanel/SidePanel';
import { Content } from './features/content/Content';
import { SettingsOverlay } from './features/settings/SettingsOverlay';
import { QuickSearch } from './features/quickSearch/QuickSearch';
import { ContextMenu } from './features/contextMenu/ContextMenu';

const Shell = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
`;

const Body = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  container-type: inline-size;
  min-height: 0;
`;

function App(): React.JSX.Element {
  useGlobalKeys();
  useGamepadBindings();
  useGamepadNavigation();
  useWindowTitle();
  useContextMenuLabels();
  const projectId = useProjectId();
  const settingsOpen = useSettingsOpen();
  const dispatch = useUiDispatch();

  const closeSettings = (): void => dispatch({ type: 'settings/setOpen', open: false });

  if (!projectId) {
    return (
      <>
        <Launchpad />
        {settingsOpen && <SettingsOverlay onClose={closeSettings} />}
        {window.gepard.host === 'browser' && <ContextMenu />}
      </>
    );
  }

  return (
    <Shell>
      <Header />
      <Body>
        <SidePanel />
        <Content />
      </Body>
      <QuickSearch />
      {settingsOpen && <SettingsOverlay onClose={closeSettings} />}
      {window.gepard.host === 'browser' && <ContextMenu />}
    </Shell>
  );
}

export default App;
