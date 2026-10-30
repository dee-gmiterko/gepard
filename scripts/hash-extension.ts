import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackedManifest {
  files?: string[];
}

// vendor is downloaded per platform from the sources pinned in package.json, so package.json covers it.
const UNHASHED_ENTRY = 'vendor';

function packedPaths(dir: string): string[] {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const [pack] = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
  return pack.files.map((f) => f.path);
}

function assertEveryEntryPacked(dir: string, files: string[], packed: string[]): void {
  for (const entry of files) {
    const name = entry.replace(/^\.\//, '').replace(/\/+$/, '');
    if (name === UNHASHED_ENTRY) continue;
    if (/[*?[\]{}!]/.test(name))
      throw new Error(`${dir}: "files" entry "${entry}" uses a glob, which is not supported`);
    if (!packed.some((p) => p === name || p.startsWith(`${name}/`)))
      throw new Error(`${dir}: "files" entry "${entry}" is missing or empty; build it first`);
  }
}

function content(dir: string, file: string): Buffer | string {
  if (file !== 'package.json') return readFileSync(path.join(dir, file));
  const manifest = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Record<
    string,
    unknown
  >;
  delete manifest.version;
  return JSON.stringify(manifest);
}

export function hashExtension(dir: string): string {
  const manifest = JSON.parse(
    readFileSync(path.join(dir, 'package.json'), 'utf8'),
  ) as PackedManifest;
  const packed = packedPaths(dir);
  assertEveryEntryPacked(dir, manifest.files ?? [], packed);
  const hash = createHash('sha256');
  const hashed = packed.filter((p) => p !== UNHASHED_ENTRY && !p.startsWith(`${UNHASHED_ENTRY}/`));
  for (const file of hashed.sort()) {
    const digest = createHash('sha256').update(content(dir, file)).digest('hex');
    hash.update(`${file}\0${digest}\n`);
  }
  return hash.digest('hex');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    console.error('Usage: tsx scripts/hash-extension.ts <extension-dir>');
    process.exitCode = 1;
  } else {
    try {
      console.log(hashExtension(path.resolve(dir)));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
