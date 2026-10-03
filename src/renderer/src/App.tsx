import styled from 'styled-components';
import { useAppDispatch, useAppState } from './state/AppContext';
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
  const state = useAppState();
  const dispatch = useAppDispatch();

  const closeSettings = (): void => dispatch({ type: 'settings/setOpen', open: false });

  if (!state.projectId) {
    return (
      <>
        <Launchpad />
        {state.settingsOpen && <SettingsOverlay onClose={closeSettings} />}
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
      {state.settingsOpen && <SettingsOverlay onClose={closeSettings} />}
    </Shell>
  );
}

export default App;
