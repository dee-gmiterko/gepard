import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import extension from '../index.mjs';

describe('typescript extension', () => {
  let dataDir;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('materializes a runnable native compiler next to its library files', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-smoke-'));

    const plan = await extension.resolve({ root: '/repo' }, { dataDir });

    await access(join(dirname(plan.command), 'lib.d.ts'));
    const { stdout } = await promisify(execFile)(plan.command, ['--version']);
    expect(stdout).toMatch(/\d+\.\d+/);
    expect(plan.args).toEqual(['--lsp', '--stdio']);
    expect(plan.cwd).toBe('/repo');
  });

  it('reuses the materialized compiler on later resolves', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-smoke-'));

    const first = await extension.resolve({ root: '/repo' }, { dataDir });
    const second = await extension.resolve({ root: '/repo' }, { dataDir });

    expect(second.command).toBe(first.command);
  });

  it('identifies its files', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-smoke-'));

    expect(extension.matches('src/a.ts')).toBe(true);
    expect(extension.matches('src/a.py')).toBe(false);
    expect(extension.languageId('a.tsx')).toBe('typescriptreact');
    expect(extension.languageId('a.mjs')).toBe('javascript');
    expect(extension.warmupFile(['types.d.ts', 'a.ts'])).toBe('a.ts');
  });
});
