import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage } from '@gepard/common';
import { pathExists } from '../helpers/fs';
import { unpackPayload } from './payload';

export interface VendoredPayload {
  vendorDir: string;
  label: string;
  // Path inside the unpacked directory whose presence marks a complete install.
  probe: string;
  installName?: (version: string) => string;
}

export async function packageRoot(startDir: string): Promise<string> {
  let dir = startDir;
  while (!(await pathExists(path.join(dir, 'package.json')))) {
    const parent = path.join(dir, '..');
    if (parent === dir) throw new Error(`no package.json above ${startDir}`);
    dir = parent;
  }
  return dir;
}

// moduleUrl is the caller's import.meta.url, so the lookup starts inside the extension.
export function extensionRoot(moduleUrl: string): Promise<string> {
  return packageRoot(path.dirname(fileURLToPath(moduleUrl)));
}

export async function materializePayload(
  payload: VendoredPayload,
  dataDir: string,
): Promise<string> {
  let version: string;
  try {
    version = (await fs.readFile(path.join(payload.vendorDir, 'version.txt'), 'utf8')).trim();
  } catch (e) {
    throw new Error(
      `Bundled ${payload.label} not found; run the extension's vendor step (${errorMessage(e)})`,
      { cause: e },
    );
  }
  const dir = path.join(dataDir, payload.installName?.(version) ?? version);
  const probe = path.join(dir, payload.probe);
  if (await pathExists(probe)) return dir;

  await fs.mkdir(dataDir, { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}`;
  await fs.rm(tmp, { recursive: true, force: true });
  await unpackPayload(await fs.readFile(path.join(payload.vendorDir, 'payload.bin')), tmp);
  try {
    await fs.rename(tmp, dir);
  } catch (e) {
    await fs.rm(tmp, { recursive: true, force: true });
    if (!(await pathExists(probe))) throw e;
  }
  return dir;
}
