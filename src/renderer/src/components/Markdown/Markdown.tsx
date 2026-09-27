import MarkdownToJsx from 'markdown-to-jsx/react'
import styled from 'styled-components'

const Prose = styled.div`
  color: ${({ theme }) => theme.colors.fg};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: ${({ theme }) => theme.font.lineHeight};

  > :first-child {
    margin-top: 0;
  }
  > :last-child {
    margin-bottom: 0;
  }

  p,
  ul,
  ol,
  pre,
  blockquote,
  table {
    margin: ${({ theme }) => theme.space[2]} 0;
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
  }

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: ${({ theme }) => theme.font.size.sm};
    background: ${({ theme }) => theme.colors.bgSubtle};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 0 3px;
  }

  pre code {
    display: block;
    padding: ${({ theme }) => theme.space[2]};
    overflow: auto;
    background: none;
  }

  blockquote {
    margin-left: 0;
    padding-left: ${({ theme }) => theme.space[2]};
    border-left: 2px solid ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.fgMuted};
  }
`

const InlineProse = styled.span`
  color: inherit;
  font: inherit;

  a {
    color: ${({ theme }) => theme.colors.accent};
  }

  code {
    font-family: ${({ theme }) => theme.font.mono};
    background: ${({ theme }) => theme.colors.bgSubtle};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 0 3px;
  }
`

export interface MarkdownProps {
  children: string
  inline?: boolean
}

export function Markdown({ children, inline = false }: MarkdownProps): React.JSX.Element {
  const Wrapper = inline ? InlineProse : Prose
  return (
    <Wrapper>
      <MarkdownToJsx options={{ disableParsingRawHTML: true, forceInline: inline }}>
        {children}
      </MarkdownToJsx>
    </Wrapper>
  )
}
