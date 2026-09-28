import type { ImageData } from '@gepard/common/ipc/schemas/pr';

export function imageSrc(image: ImageData): string {
  return `data:${image.mime};base64,${image.base64}`;
}
