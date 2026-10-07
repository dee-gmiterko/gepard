import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';
import { z } from 'zod';
import { errorMessage, packageRoot } from '@gepard/common';

const assetSchema = z.object({ url: z.string(), sha256: z.string(), strip: z.string() });
const manifestSchema = z.object({
  gepard: z.object({
    vendor: z.object({ version: z.string(), assets: z.record(z.string(), assetSchema) }),
  }),
});
type Asset = z.infer<typeof assetSchema>;

const TARGET = `${process.platform}-${process.arch}`;
const EXE_NAME = process.platform === 'win32' ? 'clangd.exe' : 'clangd';
const KEPT_DIRS = ['bin/', 'lib/'];

const inFlight = new Map<string, Promise<string>>();

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(): Promise<{ version: string; asset: Asset | undefined }> {
  const root = await packageRoot(path.dirname(fileURLToPath(import.meta.url)));
  const raw: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const { vendor } = manifestSchema.parse(raw).gepard;
  return { version: vendor.version, asset: vendor.assets[TARGET] };
}

async function download(url: string, sha256: string, file: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download of ${url} failed: ${res.status} ${res.statusText}`);
  }
  const hash = createHash('sha256');
  const hashing = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(res.body, hashing, createWriteStream(file));
  const actual = hash.digest('hex');
  if (actual !== sha256) {
    throw new Error(`checksum mismatch for ${url}: expected ${sha256}, got ${actual}`);
  }
}

function modeOf(entry: yauzl.Entry, rel: string): number {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0o777;
  if (unixMode !== 0) return unixMode;
  return rel.startsWith('bin/') ? 0o755 : 0o644;
}

function openZip(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => (err ? reject(err) : resolve(zip)));
  });
}

function entryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => (err ? reject(err) : resolve(stream)));
  });
}

async function unzip(archive: string, strip: string, dir: string): Promise<void> {
  const zip = await openZip(archive);
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          if (!entry.fileName.startsWith(strip)) return;
          const rel = entry.fileName.slice(strip.length);
          if (rel.endsWith('/') || !KEPT_DIRS.some((d) => rel.startsWith(d))) return;
          const target = path.join(dir, rel);
          if (path.relative(dir, target).startsWith('..')) {
            throw new Error(`archive entry escapes its directory: ${entry.fileName}`);
          }
          await fs.mkdir(path.dirname(target), { recursive: true });
          await pipeline(await entryStream(zip, entry), createWriteStream(target));
          await fs.chmod(target, modeOf(entry, rel));
        })().then(() => zip.readEntry(), reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

async function install(dataDir: string): Promise<string> {
  const { version, asset } = await readManifest();
  if (!asset) throw new Error(`clangd is not available for ${TARGET}`);
  const dir = path.join(dataDir, 'clangd', `${version}-${TARGET}`);
  const exe = path.join(dir, 'bin', EXE_NAME);
  if (await exists(exe)) return exe;

  await fs.mkdir(path.dirname(dir), { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}`;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });
  const archive = path.join(tmp, 'archive.zip');
  try {
    await download(asset.url, asset.sha256, archive);
    await unzip(archive, asset.strip, tmp);
    await fs.rm(archive, { force: true });
    if (!(await exists(path.join(tmp, 'bin', EXE_NAME)))) {
      throw new Error(`archive ${asset.url} contains no bin/${EXE_NAME}`);
    }
    try {
      await fs.rename(tmp, dir);
    } catch (e) {
      if (!(await exists(exe))) throw e;
    }
  } catch (e) {
    throw new Error(`failed to install clangd ${version} for ${TARGET}: ${errorMessage(e)}`, {
      cause: e,
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
  return exe;
}

export function ensureClangd(dataDir: string): Promise<string> {
  let pending = inFlight.get(dataDir);
  if (!pending) {
    pending = install(dataDir).finally(() => inFlight.delete(dataDir));
    inFlight.set(dataDir, pending);
  }
  return pending;
}
