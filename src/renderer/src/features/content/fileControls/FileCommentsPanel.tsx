import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { X } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { useSetLayout } from '../../../queries/projects';
import { useResizeHandle } from '../../../hooks/useResizeHandle';
import { useIsCheckedOutChangedFile } from '../commentScope';
import { IconButton } from '../../../components/IconButton';
import { ResizeHandle } from '../../../components/ResizeHandle';
import { Inline } from '../../../components/Layout';
import { FileComments } from '../../commentEditor/FileComments';
import { SymbolsTree } from './SymbolsTree';

const MIN_WIDTH = 220;
const MAX_WIDTH = 640;

const messages = defineMessages({
  title: {
    id: 'content.fileCommentsPanel.title',
    defaultMessage: 'File comments',
  },
  close: {
    id: 'content.fileCommentsPanel.close',
    defaultMessage: 'Close file comments',
  },
});

const Panel = styled.div<{ $width: number }>`
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 2fr) minmax(0, 1fr);
  width: ${({ $width }) => $width}px;
  min-height: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSubtle};
`;

const Handle = styled(ResizeHandle)`
  left: -3px;
`;

const Header = styled(Inline)`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
`;

const Title = styled.span`
  flex: 1;
  min-width: 0;
`;

const Body = styled.div`
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.space[2]};
`;

export function FileCommentsPanel(): React.JSX.Element | null {
  const intl = useIntl();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const setLayout = useSetLayout();
  const path = state.activeFile;
  const isChangedFile = useIsCheckedOutChangedFile(path);

  const [width, setWidth] = useState(state.layout.fileCommentsPanelWidth);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!draggingRef.current) setWidth(state.layout.fileCommentsPanelWidth);
  }, [state.layout.fileCommentsPanelWidth]);

  const { onPointerDown } = useResizeHandle({
    min: MIN_WIDTH,
    max: MAX_WIDTH,
    sign: -1,
    getValue: () => width,
    onChange: (value) => {
      draggingRef.current = true;
      setWidth(value);
    },
    onCommit: (value) => {
      draggingRef.current = false;
      dispatch({ type: 'layout/setFileCommentsPanelWidth', width: value });
      setLayout.mutate({ ...state.layout, fileCommentsPanelWidth: value });
    },
  });

  if (path === null || !isChangedFile || !state.layout.fileCommentsPanelOpen) return null;

  function close(): void {
    dispatch({ type: 'layout/setFileCommentsPanelOpen', open: false });
    setLayout.mutate({ ...state.layout, fileCommentsPanelOpen: false });
  }

  return (
    <Panel $width={width}>
      <Handle onPointerDown={onPointerDown} />
      <Header>
        <Title>{intl.formatMessage(messages.title)}</Title>
        <IconButton icon={X} size={14} label={intl.formatMessage(messages.close)} onClick={close} />
      </Header>
      <Body>
        <FileComments path={path} />
      </Body>
      <SymbolsTree path={path} />
    </Panel>
  );
}
