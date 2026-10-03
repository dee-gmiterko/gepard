import { Bookmark, Home, MessageSquare, X } from 'react-feather';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { openTabs } from '../../../state/selectors';
import { basename } from '../../../helpers/paths';
import { focusVisible } from '../../../components/controlStyles';
import { IconButton } from '../../../components/IconButton';
import { Ellipsis } from '../../../components/Ellipsis';

const messages = defineMessages({
  overview: {
    id: 'content.fileTabs.overview',
    defaultMessage: 'Overview',
  },
  allComments: {
    id: 'content.fileTabs.allComments',
    defaultMessage: 'All comments',
  },
  comments: {
    id: 'content.fileTabs.comments',
    defaultMessage: 'Comments',
  },
  close: {
    id: 'content.fileTabs.close',
    defaultMessage: 'Close {path}',
  },
  pin: {
    id: 'content.fileTabs.pin',
    defaultMessage: 'Pin {path}',
  },
});

const TabStrip = styled.div`
  display: flex;
  align-items: stretch;
  height: 32px;
  overflow-x: auto;
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TabItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  padding-right: ${({ theme }) => theme.space[1]};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $active }) => ($active ? theme.colors.bg : 'transparent')};

  &:hover {
    background: ${({ theme, $active }) => (!$active ? theme.colors.bgHover : theme.colors.bg)};
  }
`;

const Tab = styled.button<{ $active: boolean; $preview: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  align-self: stretch;
  padding: 0 ${({ theme }) => theme.space[2]};
  border: none;
  background: none;
  color: ${({ theme, $active }) => ($active ? theme.colors.fg : theme.colors.fgMuted)};
  font: inherit;
  font-style: ${({ $preview }) => ($preview ? 'italic' : 'normal')};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  white-space: nowrap;

  ${focusVisible}
`;

const Label = styled(Ellipsis)`
  max-width: 200px;
`;

export function FileTabs(): React.JSX.Element {
  const intl = useIntl();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const tabs = openTabs(state);

  return (
    <TabStrip role="tablist">
      <TabItem $active={state.mainTab === 'overview'}>
        <Tab
          type="button"
          role="tab"
          aria-selected={state.mainTab === 'overview'}
          $active={state.mainTab === 'overview'}
          $preview={false}
          title={intl.formatMessage(messages.overview)}
          onClick={() => dispatch({ type: 'mainTab/set', tab: 'overview' })}
        >
          <Home size={12} />
          <Label>
            <FormattedMessage {...messages.overview} />
          </Label>
        </Tab>
      </TabItem>
      {state.targeting.pr != null && (
        <TabItem $active={state.mainTab === 'comments'}>
          <Tab
            type="button"
            role="tab"
            aria-selected={state.mainTab === 'comments'}
            $active={state.mainTab === 'comments'}
            $preview={false}
            title={intl.formatMessage(messages.allComments)}
            onClick={() => dispatch({ type: 'mainTab/set', tab: 'comments' })}
          >
            <MessageSquare size={12} />
            <Label>
              <FormattedMessage {...messages.comments} />
            </Label>
          </Tab>
        </TabItem>
      )}
      {tabs.map((path) => {
        const isPinned = state.pinnedFiles.includes(path);
        const isActive = state.mainTab === 'files' && state.activeFile === path;
        return (
          <TabItem key={path} $active={isActive}>
            <Tab
              type="button"
              role="tab"
              aria-selected={isActive}
              $active={isActive}
              $preview={!isPinned}
              title={path}
              onClick={() => dispatch({ type: 'file/focus', path })}
              onDoubleClick={() => {
                if (!isPinned) dispatch({ type: 'file/pin', path });
              }}
            >
              <Label>{basename(path)}</Label>
            </Tab>
            {isPinned ? (
              <IconButton
                icon={X}
                size={12}
                label={intl.formatMessage(messages.close, { path })}
                onClick={() => dispatch({ type: 'file/unpin', path })}
              />
            ) : (
              <IconButton
                icon={Bookmark}
                size={12}
                label={intl.formatMessage(messages.pin, { path })}
                onClick={() => dispatch({ type: 'file/pin', path })}
              />
            )}
          </TabItem>
        );
      })}
    </TabStrip>
  );
}
