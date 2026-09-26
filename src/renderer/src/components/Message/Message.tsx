// A plain status line: placeholders ("Loading…", "No files."), empty states
// and error text across panels and viewers (spec Styling: one component
// instead of a Placeholder/Center/Empty/ErrorText block in every feature).
import type { ReactNode } from 'react'
import styled, { css } from 'styled-components'

export type MessageTone = 'muted' | 'subtle' | 'danger'
/** `block`: padded row (side panel, lists); `center`: fills and centers in
 * its container (viewers); `inline`: no spacing of its own. */
export type MessageLayout = 'block' | 'center' | 'inline'

const Box = styled.div<{ $tone: MessageTone; $layout: MessageLayout }>`
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: pre-wrap;
  color: ${({ theme, $tone }) =>
    $tone === 'danger'
      ? theme.colors.danger
      : $tone === 'subtle'
        ? theme.colors.fgSubtle
        : theme.colors.fgMuted};
  ${({ theme, $layout }) =>
    $layout === 'center'
      ? css`
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: ${theme.space[4]};
          text-align: center;
        `
      : $layout === 'block'
        ? css`
            padding: ${theme.space[3]};
          `
        : css``}
`

export interface MessageProps {
  tone?: MessageTone
  layout?: MessageLayout
  title?: string
  children: ReactNode
}

export function Message({
  tone = 'muted',
  layout = 'block',
  title,
  children
}: MessageProps): React.JSX.Element {
  return (
    <Box $tone={tone} $layout={layout} title={title} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </Box>
  )
}
