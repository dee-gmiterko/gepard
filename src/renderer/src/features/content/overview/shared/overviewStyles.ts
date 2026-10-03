import styled, { css } from 'styled-components';
import { Caption } from '../../../../components/Caption';
import { focusVisible } from '../../../../components/controlStyles';
import { Surface } from '../../../../components/Surface';

export const Page = styled.div`
  height: 100%;
  overflow: auto;
  padding: ${({ theme }) => theme.space[4]};
`;

export const PageBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[5]};
  max-width: 1000px;
  margin: 0 auto;
`;

export const LinkButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.accent};
  min-width: 0;
  max-width: 100%;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  ${focusVisible}
`;

export const PR_COLUMNS = 'minmax(0, 1fr) 100px 140px 130px 80px 80px 72px';
export const PAIR_COLUMNS = 'minmax(0, 1fr) auto';
export const GROUP_COLUMNS = 'minmax(0, 1fr) auto auto';

export const Table = styled(Surface).attrs({ $elevation: 'flat' })`
  min-width: 0;
  overflow: hidden;
`;

export const RowGrid = styled.div<{ $columns: string; $head?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $columns }) => $columns};
  align-items: center;
  gap: 0 ${({ theme }) => theme.space[3]};
  padding: ${({ theme, $head }) => ($head ? theme.space[1] : theme.space[2])}
    ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 0;

  &:last-child {
    border-bottom: none;
  }

  > * {
    min-width: 0;
  }

  > :last-child {
    justify-self: end;
  }

  ${({ $head, theme }) =>
    $head
      ? css`
          background: ${theme.colors.bgHover};
        `
      : css`
          &:hover {
            background: ${theme.colors.bgHover};
          }
        `}
`;

export const Cell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
`;

export const HeaderCell = styled(Caption)`
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

export const Num = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const Muted = styled.span`
  color: ${({ theme }) => theme.colors.fgMuted};
`;

export const Truncated = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Add = styled.span`
  color: ${({ theme }) => theme.colors.diffAddFg};
`;
export const Del = styled.span`
  margin-left: ${({ theme }) => theme.space[1]};
  color: ${({ theme }) => theme.colors.diffDelFg};
`;
