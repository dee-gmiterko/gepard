import styled from 'styled-components';
import { useAppDispatch } from './state/AppContext';
import { useProjectId, useSettingsOpen } from './state/hooks';
import { useGlobalKeys } from './keyboard/useGlobalKeys';
import { useWindowTitle } from './hooks/useWindowTitle';
import { useContextMenuLabels } from './hooks/useContextMenuLabels';
import { Launchpad } from './features/launchpad/Launchpad';
import { Header } from './features/header/Header';
import { SidePanel } from './features/sidePanel/SidePanel';
import { Content } from './features/content/Content';
import { SettingsOverlay } from './features/settings/SettingsOverlay';
import { QuickSearch } from './features/quickSearch/QuickSearch';

const Shell = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
`;

const Body = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  min-height: 0;
`;

function App(): React.JSX.Element {
  useGlobalKeys();
  useWindowTitle();
  useContextMenuLabels();
  const projectId = useProjectId();
  const settingsOpen = useSettingsOpen();
  const dispatch = useAppDispatch();

  const closeSettings = (): void => dispatch({ type: 'settings/setOpen', open: false });

  if (!projectId) {
    return (
      <>
        <Launchpad />
        {settingsOpen && <SettingsOverlay onClose={closeSettings} />}
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
    </Shell>
  );
}

export default App;
