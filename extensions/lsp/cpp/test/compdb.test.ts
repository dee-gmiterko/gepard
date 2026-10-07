import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateCompileCommands, isSourceFile, prepareCompileCommands } from '../compdb';

let root: string;
let dataDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cpp-root-'));
  dataDir = await mkdtemp(join(tmpdir(), 'cpp-data-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'include', 'lib'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'x'), { recursive: true });
  await writeFile(join(root, 'src', 'a.cpp'), '');
  await writeFile(join(root, 'src', 'b.c'), '');
  await writeFile(join(root, 'src', 'a.h'), '');
  await writeFile(join(root, 'include', 'lib', 'lib.hpp'), '');
  await writeFile(join(root, 'node_modules', 'x', 'skipped.cpp'), '');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

describe('isSourceFile', () => {
  it('matches translation units only', () => {
    expect(isSourceFile('a.cpp')).toBe(true);
    expect(isSourceFile('a.C')).toBe(true);
    expect(isSourceFile('a.h')).toBe(false);
  });
});

describe('generateCompileCommands', () => {
  it('lists every translation unit with language flags and include dirs', async () => {
    const commands = await generateCompileCommands(root);
    expect(commands.map((c) => c.file)).toEqual([
      join(root, 'src', 'a.cpp'),
      join(root, 'src', 'b.c'),
    ]);
    const [cpp, c] = commands;
    expect(cpp.directory).toBe(root);
    expect(cpp.arguments.slice(0, 2)).toEqual(['clang++', '-std=c++20']);
    expect(c.arguments.slice(0, 2)).toEqual(['clang', '-std=c17']);
    expect(cpp.arguments.filter((a) => a.startsWith('-I'))).toEqual([
      `-I${root}`,
      `-I${join(root, 'include')}`,
      `-I${join(root, 'include', 'lib')}`,
      `-I${join(root, 'src')}`,
    ]);
  });
});

describe('prepareCompileCommands', () => {
  it('synthesizes a database outside the repository', async () => {
    const plan = await prepareCompileCommands(root, dataDir);
    expect(plan.generated).toBe(true);
    expect(plan.dir.startsWith(dataDir)).toBe(true);
    const written: unknown = JSON.parse(
      await readFile(join(plan.dir, 'compile_commands.json'), 'utf8'),
    );
    expect(written).toHaveLength(2);
  });

  it('copies the project database when one exists', async () => {
    await mkdir(join(root, 'build'));
    await writeFile(join(root, 'build', 'compile_commands.json'), '[{"file":"x"}]');
    const plan = await prepareCompileCommands(root, dataDir);
    expect(plan.generated).toBe(false);
    expect(await readFile(join(plan.dir, 'compile_commands.json'), 'utf8')).toBe('[{"file":"x"}]');
  });
});
