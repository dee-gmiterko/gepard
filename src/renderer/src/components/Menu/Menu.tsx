import styled from 'styled-components'
import { ellipsis } from '../Ellipsis'
import { Surface } from '../Surface'

export const MenuAnchor = styled.div`
  position: relative;
`

export const Menu = styled(Surface).attrs({ as: 'ul' as const })`
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.z.popover};
  max-height: 280px;
  overflow: auto;
  margin: 0;
  padding: ${({ theme }) => theme.space[1]} 0;
  list-style: none;
`

export const MenuItem = styled.li<{ $active?: boolean }>`
  padding: 6px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ $active, theme }) => ($active ? theme.colors.bgHover : 'transparent')};
  cursor: pointer;
  ${ellipsis}

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`

export const MenuMessage = styled.li`
  padding: 6px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fgMuted};
`
