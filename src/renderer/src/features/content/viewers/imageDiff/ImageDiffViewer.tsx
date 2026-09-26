// Image diff viewer: two-up, old left / new right, same scale (report 04 §6:
// "like GitHub's default"). Both sides render at natural pixel size (1:1) so
// neither is independently stretched; the container scrolls if either image
// is larger than the pane.
import { useMemo } from 'react'
import styled from 'styled-components'
import type { ImageData } from '@shared/ipc/schemas/pr'
import { Image } from '../../../../components/Image'
import { Message } from '../../../../components/Message'
import { imageSrc } from '../imageSrc'

const Frame = styled.div`
  display: flex;
  height: 100%;
  overflow: auto;
`

const Side = styled.div`
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: ${({ theme }) => theme.space[4]};

  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  }
`

const Label = styled.div`
  margin-bottom: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

function ImageSide({
  label,
  path,
  image
}: {
  label: string
  path: string
  image: ImageData | null
}): React.JSX.Element {
  const url = useMemo(() => (image ? imageSrc(image) : null), [image])

  return (
    <Side>
      <Label>{label}</Label>
      {url ? (
        <Image src={url} alt={`${label}: ${path}`} />
      ) : (
        <Message tone="subtle" layout="inline">
          No image
        </Message>
      )}
    </Side>
  )
}

export function ImageDiffViewer({
  path,
  before,
  after
}: {
  path: string
  before: ImageData | null
  after: ImageData | null
}): React.JSX.Element {
  return (
    <Frame>
      <ImageSide label="Before" path={path} image={before} />
      <ImageSide label="After" path={path} image={after} />
    </Frame>
  )
}
