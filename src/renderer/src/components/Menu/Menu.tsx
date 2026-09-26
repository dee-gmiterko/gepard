// Dropdown list under an input (Combobox options, search symbol prefill).
// The parent must be `position: relative`.
import styled from 'styled-components'

export const Menu = styled.ul`
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
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.popover};
`

export const MenuItem = styled.li<{ $active?: boolean }>`
  padding: 6px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ $active, theme }) => ($active ? theme.colors.bgHover : 'transparent')};
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`

export const MenuMessage = styled.li`
  padding: 6px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fgMuted};
`
