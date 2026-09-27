import styled from 'styled-components'

const Mark = styled.mark`
  background: transparent;
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`

// JavaScript string indices are UTF-16 code units, not Unicode code points,
// so a range here can split a surrogate pair if built from the wrong source.
export type TextRange = readonly [number, number]

export function HighlightedText({
  text,
  ranges
}: {
  text: string
  ranges: readonly TextRange[]
}): React.JSX.Element {
  const sorted = [...ranges].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])
  const parts: React.ReactNode[] = []
  let cursor = 0
  sorted.forEach(([start, end], i) => {
    const from = Math.max(start, cursor)
    if (from > cursor) parts.push(text.slice(cursor, from))
    if (end > from) parts.push(<Mark key={i}>{text.slice(from, end)}</Mark>)
    cursor = Math.max(cursor, end)
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
