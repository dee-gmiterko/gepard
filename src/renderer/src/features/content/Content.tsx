import styled from 'styled-components';
import { useAppState } from '../../state/AppContext';
import { FileTabs } from './tabs/FileTabs';
import { FileViewer } from './viewers/FileViewer';
import { MissingViewer } from './viewers/missing/MissingViewer';
import { FileControls } from './fileControls/FileControls';
import { FileCommentsPanel } from './fileControls/FileCommentsPanel';
import { CommentsTab } from './comments/CommentsTab';

const Main = styled.main`
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr;
  min-width: 0;
  min-height: 0;
  background: ${({ theme }) => theme.colors.bg};
`;

const FilesRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
`;

const ViewerArea = styled.div`
  position: relative;
  min-height: 0;
  overflow: hidden;
`;

export function Content(): React.JSX.Element {
  const state = useAppState();

  return (
    <Main>
      <FileTabs />
      {state.mainTab === 'comments' ? (
        <ViewerArea>
          <CommentsTab />
        </ViewerArea>
      ) : (
        <FilesRow>
          <ViewerArea>
            {state.activeFile ? (
              <FileViewer key={state.activeFile} path={state.activeFile} />
            ) : (
              <MissingViewer path={null} />
            )}
            <FileControls />
          </ViewerArea>
          <FileCommentsPanel />
        </FilesRow>
      )}
    </Main>
  );
}
