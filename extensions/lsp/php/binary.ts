import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';
import yauzl from 'yauzl';
import { z } from 'zod';
import { errorMessage, packageRoot } from '@gepard/common';

const assetSchema = z.object({ url: z.string(), sha256: z.string() });
const manifestSchema = z.object({
  gepard: z.object({
    vendor: z.object({ version: z.string(), assets: z.record(z.string(), assetSchema) }),
  }),
});
type Asset = z.infer<typeof assetSchema>;

const TARGET = `${process.platform}-${process.arch}`;
const EXE_NAME = process.platform === 'win32' ? 'phpantom_lsp.exe' : 'phpantom_lsp';
const TAR_BLOCK = 512;

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

async function extractFromZip(archive: string, name: string, target: string): Promise<boolean> {
  const zip = await openZip(archive);
  let found = false;
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          if (path.posix.basename(entry.fileName) !== name || entry.fileName.endsWith('/')) return;
          await pipeline(await entryStream(zip, entry), createWriteStream(target));
          found = true;
        })().then(() => zip.readEntry(), reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  return found;
}

function tarField(header: Buffer, offset: number, length: number): string {
  const raw = header.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
}

async function extractFromTarGz(archive: string, name: string, target: string): Promise<boolean> {
  const tar = zlib.gunzipSync(await fs.readFile(archive));
  let offset = 0;
  while (offset + TAR_BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK);
    if (header[0] === 0) break;
    const prefix = tarField(header, 345, 155);
    const entryName = (prefix ? `${prefix}/` : '') + tarField(header, 0, 100);
    const size = parseInt(tarField(header, 124, 12).trim() || '0', 8);
    const typeflag = String.fromCharCode(header[156]);
    const dataStart = offset + TAR_BLOCK;
    if ((typeflag === '0' || typeflag === '\0') && path.posix.basename(entryName) === name) {
      await fs.writeFile(target, tar.subarray(dataStart, dataStart + size));
      return true;
    }
    offset = dataStart + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
  }
  return false;
}

async function extract(archive: string, url: string, target: string): Promise<boolean> {
  if (url.endsWith('.zip')) return extractFromZip(archive, EXE_NAME, target);
  if (url.endsWith('.tar.gz') || url.endsWith('.tgz')) {
    return extractFromTarGz(archive, EXE_NAME, target);
  }
  throw new Error(`unsupported archive format: ${url}`);
}

async function install(dataDir: string): Promise<string> {
  const { version, asset } = await readManifest();
  if (!asset) throw new Error(`phpantom is not available for ${TARGET}`);
  const dir = path.join(dataDir, 'phpantom', `${version}-${TARGET}`);
  const exe = path.join(dir, EXE_NAME);
  if (await exists(exe)) return exe;

  await fs.mkdir(path.dirname(dir), { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}`;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });
  const archive = path.join(tmp, path.posix.basename(new URL(asset.url).pathname));
  try {
    await download(asset.url, asset.sha256, archive);
    const tmpExe = path.join(tmp, EXE_NAME);
    if (!(await extract(archive, asset.url, tmpExe))) {
      throw new Error(`archive ${asset.url} contains no ${EXE_NAME}`);
    }
    await fs.chmod(tmpExe, 0o755);
    await fs.rm(archive, { force: true });
    try {
      await fs.rename(tmp, dir);
    } catch (e) {
      if (!(await exists(exe))) throw e;
    }
  } catch (e) {
    throw new Error(`failed to install phpantom ${version} for ${TARGET}: ${errorMessage(e)}`, {
      cause: e,
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
  return exe;
}

export function ensurePhpantom(dataDir: string): Promise<string> {
  let pending = inFlight.get(dataDir);
  if (!pending) {
    pending = install(dataDir).finally(() => inFlight.delete(dataDir));
    inFlight.set(dataDir, pending);
  }
  return pending;
}
