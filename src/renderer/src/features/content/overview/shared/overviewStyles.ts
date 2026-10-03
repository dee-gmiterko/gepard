import styled from 'styled-components';
import { Caption } from '../../../../components/Caption';
import { focusVisible } from '../../../../components/controlStyles';

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
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  ${focusVisible}
`;

export const Grid = styled.div<{ $columns: string }>`
  display: grid;
  grid-template-columns: ${({ $columns }) => $columns};
  align-items: center;
  gap: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 0;

  > * {
    min-width: 0;
  }
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
