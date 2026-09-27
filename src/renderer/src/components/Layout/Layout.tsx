import styled from 'styled-components'
import type { Theme } from '../../theme/tokens'

type Gap = keyof Theme['space']

export const Stack = styled.div<{ $gap?: Gap }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme, $gap = 2 }) => theme.space[$gap]};
`

export const Inline = styled.div<{ $gap?: Gap }>`
  display: flex;
  align-items: center;
  gap: ${({ theme, $gap = 2 }) => theme.space[$gap]};
  min-width: 0;
`
