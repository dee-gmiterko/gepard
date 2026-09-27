import styled from 'styled-components'
import { Caption } from '../Caption'

const Author = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
`

export function Byline({ author, time }: { author: string; time: string }): React.JSX.Element {
  return (
    <>
      <Author>{author}</Author>
      <Caption>{new Date(time).toLocaleString()}</Caption>
    </>
  )
}
