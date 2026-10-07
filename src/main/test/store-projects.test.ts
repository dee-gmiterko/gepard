import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';
import * as projects from '../store/projects';

describe('store/projects', () => {
  let userData: TmpDir;

  beforeEach(async () => {
    userData = await makeTmpDir('store-projects');
    __setUserDataDir(userData.path);
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  describe('listProjects', () => {
    it('is empty on a fresh userData dir', async () => {
      expect(await projects.listProjects()).toEqual([]);
    });

    it('lists added projects in the order they were added', async () => {
      await projects.addProject('https://github.com/o/a');
      await new Promise((r) => setTimeout(r, 5));
      await projects.addProject('https://github.com/o/b');
      expect((await projects.listProjects()).map((p) => p.id)).toEqual(['o__a', 'o__b']);
    });

    it('ignores plain files and directories without a project.json', async () => {
      await projects.addProject('https://github.com/o/good');
      await writeFile(join(userData.path, 'projects', 'note.txt'), 'x');
      await mkdir(join(userData.path, 'projects', 'o__empty'), { recursive: true });
      expect((await projects.listProjects()).map((p) => p.id)).toEqual(['o__good']);
    });

    it('still lists valid projects when a stray directory has an invalid project id', async () => {
      await projects.addProject('https://github.com/o/good');
      await mkdir(join(userData.path, 'projects', 'Not A Valid Id!'), { recursive: true });
      expect((await projects.listProjects()).map((p) => p.id)).toEqual(['o__good']);
    });

    it('still lists valid projects when another project.json is corrupt', async () => {
      await projects.addProject('https://github.com/o/good');
      await mkdir(join(userData.path, 'projects', 'o__bad'), { recursive: true });
      await writeFile(join(userData.path, 'projects', 'o__bad', 'project.json'), '{not json');
      expect((await projects.listProjects()).map((p) => p.id)).toEqual(['o__good']);
    });

    it('still lists valid projects when another project.json fails schema validation', async () => {
      await projects.addProject('https://github.com/o/good');
      await mkdir(join(userData.path, 'projects', 'o__bad'), { recursive: true });
      await writeFile(join(userData.path, 'projects', 'o__bad', 'project.json'), '{"id":1}');
      expect((await projects.listProjects()).map((p) => p.id)).toEqual(['o__good']);
    });
  });

  describe('per-project persisted state', () => {
    it('round-trips targeting and layout sequentially', async () => {
      const p = await projects.addProject('https://github.com/o/r');
      const targeting = { pr: 3, commit: null, path: null };
      const layout = { ...(await projects.getLayout(p.id)), wrapLongLines: true };
      await projects.setLastTargeting(p.id, targeting);
      await projects.setLayout(p.id, layout);
      expect(await projects.getLastTargeting(p.id)).toEqual(targeting);
      expect(await projects.getLayout(p.id)).toEqual(layout);
    });

    it('keeps both updates when targeting and layout are written concurrently', async () => {
      const p = await projects.addProject('https://github.com/o/r');
      const targeting = { pr: 3, commit: null, path: null };
      const layout = { ...(await projects.getLayout(p.id)), wrapLongLines: true };
      await Promise.all([
        projects.setLastTargeting(p.id, targeting),
        projects.setLayout(p.id, layout),
      ]);
      expect(await projects.getLastTargeting(p.id)).toEqual(targeting);
      expect((await projects.getLayout(p.id)).wrapLongLines).toBe(true);
    });

    it('keeps the last of many concurrent writers to different projects independent', async () => {
      const a = await projects.addProject('https://github.com/o/a');
      const b = await projects.addProject('https://github.com/o/b');
      await Promise.all([
        projects.setLastTargeting(a.id, { pr: 1, commit: null, path: null }),
        projects.setLastTargeting(b.id, { pr: 2, commit: null, path: null }),
      ]);
      expect((await projects.getLastTargeting(a.id)).pr).toBe(1);
      expect((await projects.getLastTargeting(b.id)).pr).toBe(2);
    });

    it('rejects writes to an unknown project', async () => {
      await expect(
        projects.setLastTargeting('o__nope', { pr: 1, commit: null, path: null }),
      ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    });
  });
});
