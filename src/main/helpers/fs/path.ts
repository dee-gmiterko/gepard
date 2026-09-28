import * as path from 'node:path';

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}
