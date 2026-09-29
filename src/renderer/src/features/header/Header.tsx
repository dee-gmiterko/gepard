import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { PrTarget } from './PrTarget';
import { CommitTarget } from './CommitTarget';
import { PathTarget } from './PathTarget';
import { useTargetingEffects } from './useTargetingEffects';
import { Grid, Sidebar } from 'react-feather';
import { IconButton } from '../../components/IconButton';
import { Ellipsis } from '../../components/Ellipsis';
import { Inline } from '../../components/Layout';
import { useIndexStatus, useSetLayout } from '../../queries/projects';
import { useAppDispatch, useAppState } from '../../state/AppContext';
import { useIsCheckedOutChangedFile } from '../content/useIsCheckedOutChangedFile';

const messages = defineMessages({
  projects: {
    id: 'header.projects',
    defaultMessage: 'Projects',
  },
  checkingOut: {
    id: 'header.checkingOut',
    defaultMessage: 'Checking out…',
  },
  indexing: {
    id: 'header.indexing',
    defaultMessage: 'Indexing…',
  },
  fileDetails: {
    id: 'content.fileControls.fileDetails',
    defaultMessage: 'File details',
  },
});

const Bar = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  height: 40px;
  padding: 0 ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Status = styled(Ellipsis)`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const Spacer = styled.div`
  flex: 1;
`;

export function Header(): React.JSX.Element {
  const intl = useIntl();
  const { pending } = useTargetingEffects();
  const dispatch = useAppDispatch();
  const state = useAppState();
  const setLayout = useSetLayout();
  const { data: index } = useIndexStatus();
  const path = state.activeFile;
  const isChangedFile = useIsCheckedOutChangedFile(path);

  function toggleFileComments(): void {
    const open = !state.layout.fileCommentsPanelOpen;
    dispatch({ type: 'layout/setFileCommentsPanelOpen', open });
    setLayout.mutate({ ...state.layout, fileCommentsPanelOpen: open });
  }

  return (
    <Bar>
      <IconButton
        icon={Grid}
        label={intl.formatMessage(messages.projects)}
        onClick={() => dispatch({ type: 'project/close' })}
      />
      <Inline $gap={5}>
        <PrTarget />
        <CommitTarget />
        <PathTarget />
      </Inline>
      {pending && (
        <Status>
          <FormattedMessage {...messages.checkingOut} />
        </Status>
      )}
      <Spacer />
      {index?.state === 'indexing' && (
        <Status>
          <FormattedMessage {...messages.indexing} />
        </Status>
      )}
      <IconButton
        icon={Sidebar}
        active={state.layout.fileCommentsPanelOpen}
        disabled={!(state.targeting.pr !== null && path !== null && isChangedFile)}
        label={intl.formatMessage(messages.fileDetails)}
        onClick={toggleFileComments}
      />
    </Bar>
  );
}
