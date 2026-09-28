const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

export function mimeForPath(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return null;
  return IMAGE_MIME_BY_EXT[path.slice(dot).toLowerCase()] ?? null;
}
