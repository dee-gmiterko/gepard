import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const MILESTONES = 'https://download.eclipse.org/jdtls/milestones';

interface Manifest {
  gepard: { vendor: { version: string; url: string; sha256: string } };
}

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res;
}

function semver(tag: string): number[] | null {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  return m ? m.slice(1).map(Number) : null;
}

const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const tags = (await (
  await get('https://api.github.com/repos/eclipse-jdtls/eclipse.jdt.ls/tags?per_page=100', headers)
).json()) as { name: string }[];

const releases = tags
  .map(({ name }) => semver(name))
  .filter((v): v is number[] => v !== null)
  .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
if (releases.length === 0) throw new Error('eclipse.jdt.ls has no release tags');
const version = releases[0].join('.');

const tarball = (await (await get(`${MILESTONES}/${version}/latest.txt`)).text()).trim();
if (!/^jdt-language-server-[\w.-]+\.tar\.gz$/.test(tarball)) {
  throw new Error(`unexpected milestone file name for ${version}: ${tarball}`);
}
const url = `${MILESTONES}/${version}/${tarball}`;
const sha256 = (await (await get(`${url}.sha256`)).text()).trim().split(/\s+/)[0];
if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`unexpected checksum for ${url}: ${sha256}`);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
manifest.gepard.vendor = { version, url, sha256 };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
