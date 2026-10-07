import styled from 'styled-components';
import { focusVisible } from './controlStyles';
import { PathLabel } from './PathLabel';

export const CHEVRON_SLOT_WIDTH = 18;
export const TREE_ROW_HEIGHT = 28;

export const TreeLabel = styled(PathLabel)`
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: inherit;
`;

const Row = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  min-height: 24px;
  padding: 2px ${({ theme }) => theme.space[2]} 2px
    calc(${({ theme }) => theme.space[2]} + ${({ $depth }) => $depth * 14}px);

  ${focusVisible}
`;

export const ChevronSlot = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 ${CHEVRON_SLOT_WIDTH}px;
  width: ${CHEVRON_SLOT_WIDTH}px;
`;

export const FileRow = styled(Row)<{ $selected: boolean }>`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ $selected, theme }) => ($selected ? theme.colors.bgSelected : 'transparent')};

  &:hover {
    background: ${({ $selected, theme }) => ($selected ? theme.colors.bgSelected : theme.colors.bgHover)};
  }
`;

export const FolderRow = styled(Row)`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.fgMuted};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;
