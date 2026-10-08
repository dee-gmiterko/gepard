import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { errorMessage } from '@gepard/common';
import { pathExists } from '../helpers/fs';
import { downloadVerified } from './download';
import { extensionRoot } from './vendored';

const TARGET = `${process.platform}-${process.arch}`;

export interface DownloadAsset {
  url: string;
  sha256: string;
}

export interface DownloadedServer<A extends DownloadAsset> {
  name: string;
  // The caller's import.meta.url; its package.json holds gepard.vendor.
  moduleUrl: string;
  assetSchema: z.ZodType<A>;
  // Posix path of the executable inside the install directory.
  exe: string;
  unpack(archive: string, dir: string, asset: A): Promise<void>;
}

export async function readVendorManifest<A>(
  moduleUrl: string,
  assetSchema: z.ZodType<A>,
): Promise<{ version: string; asset: A | undefined }> {
  const manifestSchema = z.object({
    gepard: z.object({
      vendor: z.object({ version: z.string(), assets: z.record(z.string(), assetSchema) }),
    }),
  });
  const root = await extensionRoot(moduleUrl);
  const raw: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const { vendor } = manifestSchema.parse(raw).gepard;
  return { version: vendor.version, asset: vendor.assets[TARGET] };
}

export async function installDownloadedServer<A extends DownloadAsset>(
  dataDir: string,
  server: DownloadedServer<A>,
): Promise<string> {
  const { version, asset } = await readVendorManifest(server.moduleUrl, server.assetSchema);
  if (!asset) throw new Error(`${server.name} is not available for ${TARGET}`);
  const dir = path.join(dataDir, server.name, `${version}-${TARGET}`);
  const exe = path.join(dir, server.exe);
  if (await pathExists(exe)) return exe;

  await fs.mkdir(path.dirname(dir), { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}`;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });
  const archive = path.join(tmp, path.posix.basename(new URL(asset.url).pathname));
  try {
    await downloadVerified(asset.url, archive, {
      algorithm: 'sha256',
      encoding: 'hex',
      digest: asset.sha256,
    });
    await server.unpack(archive, tmp, asset);
    await fs.rm(archive, { force: true });
    if (!(await pathExists(path.join(tmp, server.exe)))) {
      throw new Error(`archive ${asset.url} contains no ${server.exe}`);
    }
    try {
      await fs.rename(tmp, dir);
    } catch (e) {
      if (!(await pathExists(exe))) throw e;
    }
  } catch (e) {
    throw new Error(
      `failed to install ${server.name} ${version} for ${TARGET}: ${errorMessage(e)}`,
      { cause: e },
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
  return exe;
}
