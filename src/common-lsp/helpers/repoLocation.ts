import * as path from 'node:path';
import * as url from 'node:url';
import { toPosix } from '@gepard/common';

export interface RepoLocation {
  path: string;
  external: boolean;
}

export function toRepoLocation(root: string, uri: string): RepoLocation {
  if (!uri.startsWith('file:')) return { path: uri, external: true };
  const abs = url.fileURLToPath(uri);
  const rel = path.relative(root, abs);
  const isInside =
    rel.length > 0 && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  if (isInside) return { path: toPosix(rel), external: false };
  const stripped = toPosix(abs).replace(/^\/+/, '');
  return { path: stripped.length > 0 ? stripped : 'external', external: true };
}
