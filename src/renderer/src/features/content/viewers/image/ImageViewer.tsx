import { useMemo } from 'react'
import styled from 'styled-components'
import type { ImageData } from '@shared/ipc/schemas/pr'
import { Image } from '../../../../components/Image'
import { imageSrc } from '../imageSrc'

const Frame = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  overflow: auto;
  padding: ${({ theme }) => theme.space[4]};
`

export function ImageViewer({
  path,
  image
}: {
  path: string
  image: ImageData
}): React.JSX.Element {
  const url = useMemo(() => imageSrc(image), [image])

  return (
    <Frame>
      <Image $fit src={url} alt={path} />
    </Frame>
  )
}
