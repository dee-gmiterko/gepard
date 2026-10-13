import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { MissingDependencyError } from '@gepard/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findCommand, requireCommand } from '../../helpers/command';

const posixOnly = process.platform === 'win32' ? it.skip : it;

describe('requireCommand', () => {
  let bin: string;

  beforeEach(async () => {
    bin = await mkdtemp(path.join(tmpdir(), 'gepard-cmd-'));
    await writeFile(path.join(bin, 'present'), '#!/bin/sh\n');
    await chmod(path.join(bin, 'present'), 0o755);
    await writeFile(path.join(bin, 'plain'), '');
    await chmod(path.join(bin, 'plain'), 0o644);
  });

  afterEach(async () => {
    await rm(bin, { recursive: true, force: true });
  });

  it('resolves a command found on PATH', async () => {
    await expect(requireCommand('present', { PATH: bin })).resolves.toBe(path.join(bin, 'present'));
  });

  it('resolves a command given with a directory without consulting PATH', async () => {
    await expect(requireCommand(path.join(bin, 'present'), { PATH: '' })).resolves.toBe(
      path.join(bin, 'present'),
    );
  });

  it('throws a MissingDependencyError naming the command when it is not on PATH', async () => {
    const failure = requireCommand('absent', { PATH: bin });
    await expect(failure).rejects.toBeInstanceOf(MissingDependencyError);
    await expect(failure).rejects.toMatchObject({
      code: 'MISSING_DEPENDENCY',
      dependency: 'absent',
      message: 'absent: not found',
      details: { dependency: 'absent' },
    });
  });

  it('treats an unset PATH as empty', async () => {
    await expect(findCommand('present', {})).resolves.toBeNull();
  });

  posixOnly('ignores a file on PATH that is not executable', async () => {
    await expect(findCommand('plain', { PATH: bin })).resolves.toBeNull();
  });
});
