import type { ImgHTMLAttributes } from 'react';
import styled from 'styled-components';
import { useUiDispatch } from '../state/UiContext';
import { Image } from './Image';

const Zoomable = styled(Image)`
  cursor: zoom-in;
`;

export function ZoomableImage({
  src,
  alt,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>): React.JSX.Element {
  const dispatch = useUiDispatch();
  return (
    <Zoomable
      {...rest}
      src={src}
      alt={alt}
      onClick={() => {
        if (src)
          dispatch({ type: 'lightbox/open', content: { kind: 'image', src, alt: alt ?? '' } });
      }}
    />
  );
}
