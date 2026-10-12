import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PACKAGED_ENTRIES = [
  'dist',
  'vendor',
  'package.json',
  'index.mjs',
  'messages.json',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_LICENSES',
  'UPSTREAM_LICENSE',
];

const [extensionDir, platform = 'any', outDir = 'dist-release'] = process.argv.slice(2);
if (!extensionDir) {
  console.error('usage: node scripts/pack-extension.ts <extension dir> [platform] [out dir]');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
};
const archiveName = `${manifest.name}-v${manifest.version}-${platform}.tar.gz`;
const stageRoot = path.join(outDir, '.stage');
const stage = path.join(stageRoot, manifest.name);
rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const entry of PACKAGED_ENTRIES) {
  const source = path.join(extensionDir, entry);
  if (existsSync(source)) cpSync(source, path.join(stage, entry), { recursive: true });
}
if (!existsSync(path.join(stage, 'dist')) && !existsSync(path.join(stage, 'index.mjs'))) {
  console.error(`${extensionDir} has no built entry module; run its build first`);
  process.exit(1);
}

const archive = path.join(outDir, archiveName);
execFileSync('tar', ['-czf', archive, '-C', stageRoot, manifest.name], { stdio: 'inherit' });
rmSync(stageRoot, { recursive: true, force: true });
const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(`${archive}.sha256`, `${digest}  ${archiveName}\n`);
console.log(archive);
