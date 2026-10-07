import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cxx', '.c++']);
const HEADER_EXTENSIONS = new Set(['.h', '.hh', '.hpp', '.hxx', '.h++', '.inl']);
const SKIPPED_DIRS = new Set(['.git', '.cache', 'node_modules', 'out', 'third_party']);
const COMPILE_COMMANDS = 'compile_commands.json';

export interface CompileCommandsPlan {
  dir: string;
  generated: boolean;
  refresh: () => Promise<void>;
}

interface CompileCommand {
  directory: string;
  file: string;
  arguments: string[];
}

export function isSourceFile(file: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isHeaderFile(file: string): boolean {
  return HEADER_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isSkippedDir(name: string): boolean {
  return SKIPPED_DIRS.has(name) || name.startsWith('build') || name.startsWith('cmake-build-');
}

async function findExisting(root: string): Promise<string | null> {
  const candidates = [root];
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (
      entry.name === 'out' ||
      entry.name.startsWith('build') ||
      entry.name.startsWith('cmake-build-')
    ) {
      candidates.push(path.join(root, entry.name));
    }
  }
  for (const dir of candidates) {
    const file = path.join(dir, COMPILE_COMMANDS);
    const info = await fs.stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }
  return null;
}

async function walk(root: string): Promise<{ sources: string[]; headerDirs: Set<string> }> {
  const sources: string[] = [];
  const headerDirs = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const dir = pending.pop();
    if (dir === undefined) break;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isSkippedDir(entry.name)) continue;
        if (entry.name === 'include') headerDirs.add(abs);
        pending.push(abs);
      } else if (entry.isFile()) {
        if (isSourceFile(entry.name)) sources.push(abs);
        else if (isHeaderFile(entry.name)) headerDirs.add(dir);
      }
    }
  }
  return { sources, headerDirs };
}

export async function generateCompileCommands(root: string): Promise<CompileCommand[]> {
  const { sources, headerDirs } = await walk(root);
  const includes = [root, ...headerDirs].sort();
  const flags = includes.map((dir) => `-I${dir}`);
  return sources.sort().map((file) => {
    const isC = path.extname(file).toLowerCase() === '.c';
    return {
      directory: root,
      file,
      arguments: [isC ? 'clang' : 'clang++', isC ? '-std=c17' : '-std=c++20', ...flags, '-c', file],
    };
  });
}

async function writeAtomic(file: string, content: string | Buffer): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, file);
}

export async function prepareCompileCommands(
  root: string,
  dataDir: string,
): Promise<CompileCommandsPlan> {
  const dir = path.join(dataDir, 'compdb', encodeURIComponent(root));
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, COMPILE_COMMANDS);
  const existing = await findExisting(root);
  if (existing) {
    await writeAtomic(target, await fs.readFile(existing));
    return { dir, generated: false, refresh: async () => {} };
  }
  const refresh = async (): Promise<void> => {
    await writeAtomic(target, JSON.stringify(await generateCompileCommands(root), null, 2));
  };
  await refresh();
  return { dir, generated: true, refresh };
}
