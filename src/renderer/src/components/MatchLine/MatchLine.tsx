// One matched line: line number + monospace preview with the match spans
// marked (spec: search results "all matches under" the file row; the
// reference quick-selects preview the same grouped results).
import styled from 'styled-components'
import { HighlightedText, type TextRange } from '../HighlightedText'

const Row = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space[2]};
  flex: 1;
  min-width: 0;
`

const LineNo = styled.span`
  flex-shrink: 0;
  min-width: 3em;
  text-align: right;
  color: ${({ theme }) => theme.colors.fgSubtle};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.size.xs};
`

const Preview = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fg};
`

export function MatchLine({
  line,
  preview,
  spans
}: {
  line: number
  preview: string
  spans: readonly TextRange[]
}): React.JSX.Element {
  return (
    <Row>
      <LineNo>{line}</LineNo>
      <Preview>
        <HighlightedText text={preview} ranges={spans} />
      </Preview>
    </Row>
  )
}
