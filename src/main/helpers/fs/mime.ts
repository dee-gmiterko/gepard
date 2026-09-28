import { lookup } from 'mime-types';

export function mimeForPath(path: string): string | null {
  const mime = lookup(path);
  if (!mime || !mime.startsWith('image/')) return null;
  return mime;
}
