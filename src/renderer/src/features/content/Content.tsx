// Main - content (spec): active file tabs (pinned + one switching active
// file) showing file or diff view with inline comments, a floating file
// controls panel, and a Comments tab (chronological view of all threads).
import styled from 'styled-components'
import { useAppState } from '../../state/AppContext'
import { FileTabs } from './tabs/FileTabs'
import { FileViewer } from './viewers/FileViewer'
import { MissingViewer } from './viewers/missing/MissingViewer'
import { FileControls } from './fileControls/FileControls'
import { CommentsTab } from './comments/CommentsTab'

const Main = styled.main`
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr;
  min-width: 0;
  min-height: 0;
  background: ${({ theme }) => theme.colors.bg};
`

const ViewerArea = styled.div`
  position: relative;
  min-height: 0;
  overflow: hidden;
`

export function Content(): React.JSX.Element {
  const state = useAppState()

  return (
    <Main>
      <FileTabs />
      {state.mainTab === 'comments' ? (
        <ViewerArea>
          <CommentsTab />
        </ViewerArea>
      ) : (
        <ViewerArea>
          {/* FileViewer picks diff vs file view (spec Behaviors;
              state.checkout) and, from the fetched content/diff `kind`, one of
              the five viewers (code, code diff, image, image diff, missing). */}
          {state.activeFile ? (
            <FileViewer key={state.activeFile} path={state.activeFile} />
          ) : (
            <MissingViewer path={null} />
          )}
          <FileControls />
        </ViewerArea>
      )}
    </Main>
  )
}
