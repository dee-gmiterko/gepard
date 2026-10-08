import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import {
  dedupeInFlight,
  forEachZipEntry,
  installDownloadedServer,
  type ZipEntry,
} from '@gepard/common-lsp';

const assetSchema = z.object({ url: z.string(), sha256: z.string(), strip: z.string() });
type Asset = z.infer<typeof assetSchema>;

const EXE_NAME = process.platform === 'win32' ? 'clangd.exe' : 'clangd';
const KEPT_DIRS = ['bin/', 'lib/'];

function modeOf(entry: ZipEntry, rel: string): number {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0o777;
  if (unixMode !== 0) return unixMode;
  return rel.startsWith('bin/') ? 0o755 : 0o644;
}

async function unzip(archive: string, dir: string, { strip }: Asset): Promise<void> {
  await forEachZipEntry(archive, async (entry, open) => {
    if (!entry.fileName.startsWith(strip)) return;
    const rel = entry.fileName.slice(strip.length);
    if (rel.endsWith('/') || !KEPT_DIRS.some((d) => rel.startsWith(d))) return;
    const target = path.join(dir, rel);
    if (path.relative(dir, target).startsWith('..')) {
      throw new Error(`archive entry escapes its directory: ${entry.fileName}`);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await pipeline(await open(), createWriteStream(target));
    await fs.chmod(target, modeOf(entry, rel));
  });
}

export const ensureClangd = dedupeInFlight((dataDir) =>
  installDownloadedServer(dataDir, {
    name: 'clangd',
    moduleUrl: import.meta.url,
    assetSchema,
    exe: `bin/${EXE_NAME}`,
    unpack: unzip,
  }),
);
