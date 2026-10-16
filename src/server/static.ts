import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, normalize, resolve, sep } from 'node:path';
import { contentType, lookup } from 'mime-types';
import { HOST_META_NAME } from '@gepard/common';

export function resolveStaticPath(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const absoluteRoot = resolve(root);
  const target = normalize(join(absoluteRoot, decoded === '/' ? '/index.html' : decoded));
  return target.startsWith(absoluteRoot + sep) ? target : null;
}

const HOST_META = `<meta name="${HOST_META_NAME}" content="server" />`;

export function markServerHost(html: string): string {
  return html.replace(/<head>/i, (head) => `${head}${HOST_META}`);
}

function cacheControl(urlPath: string): string {
  return urlPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

export function createStaticHandler(
  root: string,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;
    const file = req.method === 'GET' ? resolveStaticPath(root, urlPath) : null;
    const info = file === null ? null : await stat(file).catch(() => null);
    if (file === null || info === null || !info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const type = lookup(file) || 'application/octet-stream';
    const headers = {
      'Content-Type': contentType(type) || type,
      'Cache-Control': cacheControl(urlPath),
    };
    if (file === resolveStaticPath(root, '/')) {
      res.writeHead(200, headers).end(markServerHost(await readFile(file, 'utf8')));
      return;
    }
    res.writeHead(200, headers);
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  };
}
