import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface ExtensionManifest {
  name: string;
  scripts?: Record<string, string>;
  gepard?: { platforms?: string[] };
}

export interface MatrixEntry {
  path: string;
  name: string;
  tag: string;
  platform: string;
  build: boolean;
}

export function buildMatrix(
  outputs: Record<string, string>,
  readManifest: (dir: string) => ExtensionManifest,
): MatrixEntry[] {
  const released: unknown = JSON.parse(outputs.paths_released ?? '[]');
  if (!Array.isArray(released)) throw new Error('paths_released is not an array');
  const entries: MatrixEntry[] = [];
  for (const dir of released) {
    if (typeof dir !== 'string' || !dir.startsWith('extensions/')) continue;
    const tag = outputs[`${dir}--tag_name`];
    if (!tag) throw new Error(`no tag for released path ${dir}`);
    const manifest = readManifest(dir);
    const platforms = manifest.gepard?.platforms?.length ? manifest.gepard.platforms : ['any'];
    for (const platform of platforms)
      entries.push({
        path: dir,
        name: manifest.name,
        tag,
        platform,
        build: manifest.scripts?.build !== undefined,
      });
  }
  return entries;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const outputs: unknown = JSON.parse(process.env.RELEASE_OUTPUTS ?? '{}');
  if (typeof outputs !== 'object' || outputs === null)
    throw new Error('RELEASE_OUTPUTS is not an object');
  const entries = buildMatrix(
    outputs as Record<string, string>,
    (dir) => JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as ExtensionManifest,
  );
  const lines = [`matrix=${JSON.stringify({ include: entries })}`, `count=${entries.length}`];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
}
