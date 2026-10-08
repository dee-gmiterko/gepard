import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as zlib from 'node:zlib';
import { z } from 'zod';
import {
  dedupeInFlight,
  forEachZipEntry,
  installDownloadedServer,
  type DownloadAsset,
} from '@gepard/common-lsp';

const assetSchema = z.object({ url: z.string(), sha256: z.string() });

const EXE_NAME = process.platform === 'win32' ? 'phpantom_lsp.exe' : 'phpantom_lsp';
const TAR_BLOCK = 512;

async function extractFromZip(archive: string, name: string, target: string): Promise<boolean> {
  let found = false;
  await forEachZipEntry(archive, async (entry, open) => {
    if (path.posix.basename(entry.fileName) !== name || entry.fileName.endsWith('/')) return;
    await pipeline(await open(), createWriteStream(target));
    found = true;
  });
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

async function unpack(archive: string, dir: string, asset: DownloadAsset): Promise<void> {
  const exe = path.join(dir, EXE_NAME);
  if (await extract(archive, asset.url, exe)) await fs.chmod(exe, 0o755);
}

export const ensurePhpantom = dedupeInFlight((dataDir) =>
  installDownloadedServer(dataDir, {
    name: 'phpantom',
    moduleUrl: import.meta.url,
    assetSchema,
    exe: EXE_NAME,
    unpack,
  }),
);
