// Shared by the image and image-diff viewers: turns the base64 payload
// `files.content`/`files.diff` return (schemas/pr.ts `ImageData`) into an
// <img> src (report 04 §6). A data: URL (allowed by the CSP's img-src) needs
// no revoke/cleanup, so it can be derived during render.
import type { ImageData } from '@shared/ipc/schemas/pr'

export function imageSrc(image: ImageData): string {
  return `data:${image.mime};base64,${image.base64}`
}
