import type { KeyboardEvent } from 'react';
import { Bookmark, MessageSquare, X } from 'react-feather';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { openTabs } from '../../../state/selectors';
import { IconButton, focusVisible } from '../../../components/IconButton';
import { Ellipsis } from '../../../components/Ellipsis';

const messages = defineMessages({
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

const Tab = styled.div<{ $active: boolean; $preview: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  flex: 0 0 auto;
  padding: 0 ${({ theme }) => theme.space[2]};
  border: none;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $active }) => ($active ? theme.colors.bg : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.fg : theme.colors.fgMuted)};
  font-style: ${({ $preview }) => ($preview ? 'italic' : 'normal')};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: ${({ theme, $active }) => (!$active ? theme.colors.bgHover : theme.colors.bg)};
  }

  ${focusVisible}
`;

const Label = styled(Ellipsis)`
  max-width: 200px;
`;

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

function onTabKeyDown(onActivate: () => void): (e: KeyboardEvent<HTMLDivElement>) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onActivate();
  };
}

export function FileTabs(): React.JSX.Element {
  const intl = useIntl();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const tabs = openTabs(state);

  return (
    <TabStrip role="tablist">
      {state.targeting.pr != null && (
        <Tab
          role="tab"
          tabIndex={0}
          aria-selected={state.mainTab === 'comments'}
          $active={state.mainTab === 'comments'}
          $preview={false}
          title={intl.formatMessage(messages.allComments)}
          onClick={() => dispatch({ type: 'mainTab/set', tab: 'comments' })}
          onKeyDown={onTabKeyDown(() => dispatch({ type: 'mainTab/set', tab: 'comments' }))}
        >
          <MessageSquare size={12} />
          <Label>
            <FormattedMessage {...messages.comments} />
          </Label>
        </Tab>
      )}
      {tabs.map((path) => {
        const isPinned = state.pinnedFiles.includes(path);
        const isActive = state.mainTab === 'files' && state.activeFile === path;
        return (
          <Tab
            key={path}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
            $active={isActive}
            $preview={!isPinned}
            title={path}
            onClick={() => dispatch({ type: 'file/focus', path })}
            onKeyDown={onTabKeyDown(() => dispatch({ type: 'file/focus', path }))}
            onDoubleClick={() => {
              if (!isPinned) dispatch({ type: 'file/pin', path });
            }}
          >
            <Label>{basename(path)}</Label>
            {isPinned ? (
              <IconButton
                icon={X}
                size={12}
                label={intl.formatMessage(messages.close, { path })}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'file/unpin', path });
                }}
              />
            ) : (
              <IconButton
                icon={Bookmark}
                size={12}
                label={intl.formatMessage(messages.pin, { path })}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'file/pin', path });
                }}
              />
            )}
          </Tab>
        );
      })}
    </TabStrip>
  );
}
