import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hashExtension } from '../hash-extension';

const dirs: string[] = [];

function extension(files: Record<string, string>, manifest: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'gepard-hash-'));
  dirs.push(dir);
  const pkg = { name: 'ext', version: '1.0.0', files: ['dist'], ...manifest };
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), body);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('hashExtension', () => {
  it('ignores files that are not packed and the version', () => {
    const a = extension({ 'dist/index.js': 'x', 'CHANGELOG.md': 'one', 'src.ts': 'a' });
    const b = extension(
      { 'dist/index.js': 'x', 'CHANGELOG.md': 'two', 'src.ts': 'b' },
      { version: '2.0.0' },
    );
    expect(hashExtension(a)).toBe(hashExtension(b));
  });

  it('changes when a packed file changes', () => {
    const a = extension({ 'dist/index.js': 'x' });
    const b = extension({ 'dist/index.js': 'y' });
    expect(hashExtension(a)).not.toBe(hashExtension(b));
  });

  it('changes when another package.json field changes', () => {
    const a = extension({ 'dist/index.js': 'x' });
    const b = extension({ 'dist/index.js': 'x' }, { description: 'other' });
    expect(hashExtension(a)).not.toBe(hashExtension(b));
  });

  it('fails when a files entry is missing', () => {
    expect(() => hashExtension(extension({}))).toThrow(/missing or empty/);
  });

  it('fails when a files entry is an empty directory', () => {
    const dir = extension({});
    mkdirSync(path.join(dir, 'dist'));
    expect(() => hashExtension(dir)).toThrow(/missing or empty/);
  });

  it('does not hash or require vendor', () => {
    const a = extension({ 'dist/index.js': 'x' }, { files: ['dist', 'vendor'] });
    const b = extension(
      { 'dist/index.js': 'x', 'vendor/bin': 'payload' },
      { files: ['dist', 'vendor'] },
    );
    expect(hashExtension(a)).toBe(hashExtension(b));
  });
});
