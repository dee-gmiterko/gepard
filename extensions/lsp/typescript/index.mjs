import { access, mkdir, readFile, rename, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpackPayload } from './payload.mjs';

const TS_EXTENSIONS = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/;

const TARGET = `${process.platform}-${process.arch}`;
const VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vendor', TARGET);
const EXE_NAME = process.platform === 'win32' ? 'tsc.exe' : 'tsc';

function languageId(filePath) {
  if (filePath.endsWith('.tsx')) return 'typescriptreact';
  if (filePath.endsWith('.jsx')) return 'javascriptreact';
  if (/\.(mjs|cjs|js)$/.test(filePath)) return 'javascript';
  return 'typescript';
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function materialize(dataDir) {
  let version;
  try {
    version = (await readFile(path.join(VENDOR_DIR, 'version.txt'), 'utf8')).trim();
  } catch (e) {
    throw new Error(
      `Bundled TypeScript payload for ${TARGET} not found; run the extension's vendor step (${e.message})`,
    );
  }
  const dir = path.join(dataDir, `${version}-${TARGET}`);
  const exe = path.join(dir, EXE_NAME);
  if (await exists(exe)) return exe;

  await mkdir(dataDir, { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  await unpackPayload(await readFile(path.join(VENDOR_DIR, 'payload.bin')), tmp);
  try {
    await rename(tmp, dir);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    if (!(await exists(exe))) throw e;
  }
  return exe;
}

export default {
  id: 'typescript',
  displayName: 'TypeScript',
  matches(filePath) {
    return TS_EXTENSIONS.test(filePath);
  },
  languageId,
  warmupFile(files) {
    return files.find((f) => TS_EXTENSIONS.test(f) && !f.endsWith('.d.ts'));
  },
  async resolve(project, host) {
    return {
      command: await materialize(host.dataDir),
      args: ['--lsp', '--stdio'],
      cwd: project.root,
    };
  },
};
