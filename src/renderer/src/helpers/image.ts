import type { ImageData } from '@gepard/common';

export function imageSrc(image: ImageData): string {
  return `data:${image.mime};base64,${image.base64}`;
}
