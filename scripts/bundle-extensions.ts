import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT_DIR, 'dist/extensions');

const BUNDLED_EXTENSIONS = [
  'extensions/themes/dark',
  'extensions/themes/dark-high-contrast',
  'extensions/themes/light',
  'extensions/themes/light-high-contrast',
  'extensions/locales/en',
];

rmSync(OUT_DIR, { recursive: true, force: true });
for (const dir of BUNDLED_EXTENSIONS) {
  const source = path.join(ROOT_DIR, dir);
  const manifest = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8')) as {
    name: string;
    files?: string[];
  };
  const dest = path.join(OUT_DIR, manifest.name);
  mkdirSync(dest, { recursive: true });
  for (const file of ['package.json', ...(manifest.files ?? [])]) {
    cpSync(path.join(source, file), path.join(dest, file), { recursive: true });
  }
}
