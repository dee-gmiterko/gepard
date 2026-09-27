import styled from 'styled-components'

export type SurfaceElevation = 'flat' | 'popover' | 'floating'

export const Surface = styled.div<{ $elevation?: SurfaceElevation }>`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme, $elevation = 'popover' }) =>
    $elevation === 'floating'
      ? theme.shadow.floating
      : $elevation === 'flat'
        ? 'none'
        : theme.shadow.popover};
`
