import styled from 'styled-components';
import { defineMessages, useIntl } from 'react-intl';
import { PrTarget } from './PrTarget';
import { CommitTarget } from './CommitTarget';
import { PathTarget } from './PathTarget';
import { useTargetingEffects } from './useTargetingEffects';
import { HeaderLogo } from './HeaderLogo';
import { HeaderStatus } from './HeaderStatus';
import { HeaderSyncButton } from './HeaderSyncButton';
import { Sidebar } from 'react-feather';
import { IconButton } from '../../components/IconButton';
import { Inline } from '../../components/Layout';
import { useSetLayout } from '../../queries/projects';
import { useUiDispatch } from '../../state/UiContext';
import { useActiveFile, useLayout, useTargeting } from '../../state/hooks';
import { useIsCheckedOutChangedFile } from '../../queries/review';

const messages = defineMessages({
  fileDetails: {
    id: 'content.fileControls.fileDetails',
    defaultMessage: 'File details',
  },
});

const Bar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  height: 40px;
  padding: 0 ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  min-width: 0;
`;

export function Header(): React.JSX.Element {
  const intl = useIntl();
  const { pending } = useTargetingEffects();
  const dispatch = useUiDispatch();
  const layout = useLayout();
  const targeting = useTargeting();
  const setLayout = useSetLayout();
  const path = useActiveFile();
  const isChangedFile = useIsCheckedOutChangedFile(path);

  function toggleFileComments(): void {
    const open = !layout.fileCommentsPanelOpen;
    dispatch({ type: 'layout/setFileCommentsPanelOpen', open });
    setLayout.mutate({ ...layout, fileCommentsPanelOpen: open });
  }

  return (
    <Bar>
      <Group>
        <HeaderLogo />
        <Inline $gap={5}>
          <PrTarget />
          <CommitTarget />
          <PathTarget />
        </Inline>
      </Group>
      <HeaderStatus pending={pending} />
      <HeaderSyncButton />
      <IconButton
        icon={Sidebar}
        active={layout.fileCommentsPanelOpen}
        disabled={path === null || (targeting.pr !== null && !isChangedFile)}
        label={intl.formatMessage(messages.fileDetails)}
        onClick={toggleFileComments}
      />
    </Bar>
  );
}
