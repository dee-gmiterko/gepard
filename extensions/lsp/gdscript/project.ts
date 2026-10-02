import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { GD_EXTENSIONS } from './helpers/language';

export const PROJECT_FILE = 'project.godot';
const SKIPPED_DIRS = new Set(['.git', '.godot', 'node_modules']);

export async function findProjectDir(root: string): Promise<string | null> {
  let level = [root];
  while (level.length > 0) {
    const next: string[] = [];
    for (const dir of level) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      if (entries.some((e) => e.isFile() && e.name === PROJECT_FILE)) return dir;
      for (const e of entries) {
        if (e.isDirectory() && !SKIPPED_DIRS.has(e.name)) next.push(path.join(dir, e.name));
      }
    }
    level = next.sort();
  }
  return null;
}

export async function listScripts(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIPPED_DIRS.has(e.name)) out.push(...(await listScripts(file)));
    } else if (GD_EXTENSIONS.test(e.name)) out.push(file);
  }
  return out;
}

export function editorEnv(dataDir: string): Record<string, string> {
  const editorDir = path.join(dataDir, 'editor');
  if (process.platform === 'win32') {
    return {
      APPDATA: path.join(editorDir, 'roaming'),
      LOCALAPPDATA: path.join(editorDir, 'local'),
    };
  }
  if (process.platform === 'darwin') return {};
  return {
    XDG_CONFIG_HOME: path.join(editorDir, 'config'),
    XDG_DATA_HOME: path.join(editorDir, 'data'),
    XDG_CACHE_HOME: path.join(editorDir, 'cache'),
  };
}
