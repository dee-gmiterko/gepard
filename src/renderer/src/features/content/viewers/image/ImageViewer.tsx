import { useMemo } from 'react';
import type { ImageData } from '@gepard/common';
import { Image } from '../../../../components/Image';
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
      <Image src={url} alt={path} />
    </ViewerFrame>
  );
}
