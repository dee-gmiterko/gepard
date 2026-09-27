import styled, { css } from 'styled-components'
import type { Theme } from '../../theme/tokens'

type Gap = keyof Theme['space']

export const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

export const ListRow = styled.li<{ $gap?: Gap; $padding?: Gap; $clickable?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme, $gap = 3 }) => theme.space[$gap]};
  padding: ${({ theme, $padding = 3 }) => theme.space[$padding]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

  ${({ $clickable, theme }) =>
    $clickable &&
    css`
      &:hover {
        background: ${theme.colors.bgHover};
      }
    `}
`
