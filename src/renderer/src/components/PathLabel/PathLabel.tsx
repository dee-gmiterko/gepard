// A repo path (optionally with :line) in monospace, truncated to one line.
import styled from 'styled-components'

export const PathLabel = styled.span<{ $small?: boolean }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme, $small }) => ($small ? theme.font.size.xs : 'inherit')};
  color: ${({ theme }) => theme.colors.fgMuted};
`
