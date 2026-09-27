// Unlike a blob: URL, a data: URL needs no revoke/cleanup, so it can be
// derived directly during render.
import type { ImageData } from '@shared/ipc/schemas/pr'

export function imageSrc(image: ImageData): string {
  return `data:${image.mime};base64,${image.base64}`
}
