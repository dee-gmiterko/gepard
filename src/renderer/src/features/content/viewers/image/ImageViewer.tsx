import { useMemo } from 'react';
import type { ImageData } from '@gepard/common';
import { ZoomableImage } from '../../../../components/ZoomableImage';
import { ViewerFrame } from '../ViewerFrame';
import { imageSrc } from '../../../../helpers/image';

export function ImageViewer({
  path,
  image,
}: {
  path: string;
  image: ImageData;
}): React.JSX.Element {
  const url = useMemo(() => imageSrc(image), [image]);

  return (
    <ViewerFrame $center>
      <ZoomableImage src={url} alt={path} />
    </ViewerFrame>
  );
}
