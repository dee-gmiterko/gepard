import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryInput } from '@gepard/common';
import { ExtensionRegistry } from '../../extensions/registry';
import {
  ExtensionInstaller,
  findPackageRoot,
  parseChecksumFile,
  type GitHubRelease,
  type ReleaseSource,
} from '../../extensions/releases';
import { DEMO_LANG_BODY, writePackage } from '../support/extensionPackages';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const execFileAsync = promisify(execFile);

const CATALOG = JSON.stringify({
  schemaVersion: 1,
  repository: 'dee-gmiterko/gepard',
  extensions: {
    'gepard-ext-demo': {
      displayName: 'Demo',
      kind: 'lsp',
      description: 'demo',
      path: 'extensions/lsp/demo',
      version: '0.2.0',
      platforms: ['linux-x64', 'any'],
    },
    'gepard-ext-exotic': {
      displayName: 'Exotic',
      kind: 'lsp',
      description: 'exotic',
      path: 'extensions/lsp/exotic',
      version: '1.0.0',
      platforms: ['darwin-arm64'],
    },
  },
});

interface FakeAsset {
  file: string;
}

class FakeSource implements ReleaseSource {
  readonly assets = new Map<string, FakeAsset>();
  readonly files = new Map<string, string>();
  releases: GitHubRelease[] = [];
  readonly downloads: string[] = [];

  listReleases(): Promise<GitHubRelease[]> {
    return Promise.resolve(this.releases);
  }

  readRepoFile(_repo: RepositoryInput, filePath: string): Promise<string> {
    const text = this.files.get(filePath);
    if (text === undefined) return Promise.reject(new Error(`404 ${filePath}`));
    return Promise.resolve(text);
  }

  async downloadAsset(
    _repo: RepositoryInput,
    tag: string,
    assetName: string,
    destDir: string,
  ): Promise<string> {
    this.downloads.push(`${tag}/${assetName}`);
    const asset = this.assets.get(`${tag}/${assetName}`);
    if (!asset) throw new Error(`no asset ${tag}/${assetName}`);
    const target = join(destDir, assetName);
    await copyFile(asset.file, target);
    return target;
  }
}

async function sha256(file: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}

describe('ExtensionInstaller', () => {
  let tmp: TmpDir;
  let registry: ExtensionRegistry;
  let source: FakeSource;
  let installer: ExtensionInstaller;
  let userExtensions: string;

  async function buildRelease(
    name: string,
    version: string,
    platform: string,
    options: { id?: string; corrupt?: boolean; tag?: string } = {},
  ): Promise<string> {
    const stage = join(tmp.path, 'stage', `${name}-${version}-${platform}`);
    await mkdir(stage, { recursive: true });
    const id = options.id ?? name.replace(/^gepard-ext-/, '');
    await writePackage(stage, name, DEMO_LANG_BODY.replace('demo-lang', id), {
      name,
      version,
    });
    const tag = options.tag ?? `${name}-v${version}`;
    const assetName = `${name}-v${version}-${platform}.tar.gz`;
    const archive = join(tmp.path, 'releases', `${tag}--${assetName}`);
    await mkdir(join(tmp.path, 'releases'), { recursive: true });
    await execFileAsync('tar', ['-czf', archive, '-C', stage, name]);
    const checksum = `${archive}.sha256`;
    const digest = options.corrupt ? '0'.repeat(64) : await sha256(archive);
    await writeFile(checksum, `${digest}  ${assetName}\n`);
    source.assets.set(`${tag}/${assetName}`, { file: archive });
    source.assets.set(`${tag}/${assetName}.sha256`, { file: checksum });
    return assetName;
  }

  beforeEach(async () => {
    tmp = await makeTmpDir('ext-install');
    const userData = join(tmp.path, 'userData');
    await mkdir(userData, { recursive: true });
    __setUserDataDir(userData);
    userExtensions = join(userData, 'extensions', 'lsp');
    const builtins = join(tmp.path, 'builtins');
    await mkdir(builtins, { recursive: true });
    registry = new ExtensionRegistry(undefined, builtins);
    source = new FakeSource();
    installer = new ExtensionInstaller({
      registry,
      source,
      fetchText: () => Promise.resolve(CATALOG),
      target: 'linux-x64',
      tmpDir: () => tmp.path,
    });
  });

  afterEach(async () => {
    await tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('installs an extension from the catalog, verifying the checksum', async () => {
    await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');

    const list = await installer.installFromCatalog('gepard-ext-demo');

    expect(source.downloads).toEqual([
      'gepard-ext-demo-v0.2.0/gepard-ext-demo-v0.2.0-linux-x64.tar.gz',
      'gepard-ext-demo-v0.2.0/gepard-ext-demo-v0.2.0-linux-x64.tar.gz.sha256',
    ]);
    expect(list).toEqual([
      expect.objectContaining({
        id: 'demo',
        packageName: 'gepard-ext-demo',
        version: '0.2.0',
        source: 'external',
        enabled: true,
      }),
    ]);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo-0.2.0']);
    expect(await readdir(tmp.path)).not.toContain(expect.stringMatching(/^gepard-ext-/));
  });

  it('falls back to the "any" archive and rejects unsupported platforms', async () => {
    const other = new ExtensionInstaller({
      registry,
      source,
      fetchText: () => Promise.resolve(CATALOG),
      target: 'win32-arm64',
      tmpDir: () => tmp.path,
    });
    await buildRelease('gepard-ext-demo', '0.2.0', 'any');
    await other.installFromCatalog('gepard-ext-demo');
    expect(source.downloads[0]).toBe('gepard-ext-demo-v0.2.0/gepard-ext-demo-v0.2.0-any.tar.gz');

    await expect(other.installFromCatalog('gepard-ext-exotic')).rejects.toMatchObject({
      code: 'EXTENSION_UNSUPPORTED_PLATFORM',
    });
    await expect(other.installFromCatalog('gepard-ext-unknown')).rejects.toMatchObject({
      code: 'EXTENSION_NOT_IN_CATALOG',
    });
  });

  it('refuses an archive whose checksum does not match and leaves nothing installed', async () => {
    await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64', { corrupt: true });
    await expect(installer.installFromCatalog('gepard-ext-demo')).rejects.toMatchObject({
      code: 'EXTENSION_CHECKSUM_MISMATCH',
    });
    expect(await registry.list()).toEqual([]);
  });

  it('refuses an archive that contains a different package than requested', async () => {
    await buildRelease('gepard-ext-other', '0.2.0', 'linux-x64', {
      tag: 'gepard-ext-demo-v0.2.0',
    });
    source.assets.set('gepard-ext-demo-v0.2.0/gepard-ext-demo-v0.2.0-linux-x64.tar.gz', {
      file: join(
        tmp.path,
        'releases',
        'gepard-ext-demo-v0.2.0--gepard-ext-other-v0.2.0-linux-x64.tar.gz',
      ),
    });
    const checksum = join(
      tmp.path,
      'releases',
      'gepard-ext-demo-v0.2.0--gepard-ext-other-v0.2.0-linux-x64.tar.gz.sha256',
    );
    const digest = (await readFile(checksum, 'utf8')).slice(0, 64);
    await writeFile(checksum, `${digest}  gepard-ext-demo-v0.2.0-linux-x64.tar.gz\n`);
    source.assets.set('gepard-ext-demo-v0.2.0/gepard-ext-demo-v0.2.0-linux-x64.tar.gz.sha256', {
      file: checksum,
    });
    await expect(installer.installFromCatalog('gepard-ext-demo')).rejects.toMatchObject({
      code: 'EXTENSION_INVALID_PACKAGE',
    });
    expect(await registry.list()).toEqual([]);
  });

  describe('from a GitHub repository', () => {
    it('installs the latest release asset for the current platform', async () => {
      const older = await buildRelease('gepard-ext-demo', '0.1.0', 'linux-x64');
      const newer = await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');
      source.releases = [
        { tag_name: 'gepard-ext-demo-v0.3.0', draft: true, prerelease: false, assets: [] },
        {
          tag_name: 'v9.0.0',
          draft: false,
          prerelease: false,
          assets: [{ name: 'gepard-9.0.0.AppImage' }],
        },
        {
          tag_name: 'gepard-ext-demo-v0.2.0',
          draft: false,
          prerelease: false,
          assets: [{ name: newer }, { name: `${newer}.sha256` }],
        },
        {
          tag_name: 'gepard-ext-demo-v0.1.0',
          draft: false,
          prerelease: false,
          assets: [{ name: older }, { name: `${older}.sha256` }],
        },
      ];

      const list = await installer.installFromRepo('https://github.com/dee-gmiterko/gepard', '');
      expect(list.map((e) => e.version)).toEqual(['0.2.0']);
      expect(source.downloads[0]).toBe(`gepard-ext-demo-v0.2.0/${newer}`);
    });

    it('uses the package at the given path to pick the matching component release', async () => {
      const demo = await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');
      const other = await buildRelease('gepard-ext-other', '0.5.0', 'any');
      source.files.set(
        'extensions/lsp/other/package.json',
        JSON.stringify({ name: 'gepard-ext-other' }),
      );
      source.releases = [
        {
          tag_name: 'gepard-ext-demo-v0.2.0',
          draft: false,
          prerelease: false,
          assets: [{ name: demo }, { name: `${demo}.sha256` }],
        },
        {
          tag_name: 'gepard-ext-other-v0.5.0',
          draft: false,
          prerelease: false,
          assets: [{ name: other }, { name: `${other}.sha256` }],
        },
      ];

      const list = await installer.installFromRepo('dee-gmiterko/gepard', '/extensions/lsp/other/');
      expect(list).toEqual([
        expect.objectContaining({ packageName: 'gepard-ext-other', version: '0.5.0' }),
      ]);
      expect(await readdir(userExtensions)).toEqual(['gepard-ext-other-0.5.0']);
    });

    it('reports a missing package.json, a missing release and bad input', async () => {
      await expect(
        installer.installFromRepo('dee-gmiterko/gepard', 'nowhere'),
      ).rejects.toMatchObject({
        code: 'EXTENSION_INVALID_PACKAGE',
      });
      source.releases = [{ tag_name: 'v1.0.0', draft: false, prerelease: false, assets: [] }];
      await expect(installer.installFromRepo('dee-gmiterko/gepard', null)).rejects.toMatchObject({
        code: 'EXTENSION_RELEASE_NOT_FOUND',
      });
      await expect(installer.installFromRepo('not a repo', null)).rejects.toMatchObject({
        code: 'BAD_INPUT',
      });
    });
  });

  it('updates in place: the old version directory is removed and the new one listed', async () => {
    await buildRelease('gepard-ext-demo', '0.1.0', 'linux-x64');
    await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');
    const first = await new ExtensionInstaller({
      registry,
      source,
      fetchText: () => Promise.resolve(CATALOG.replace('"version":"0.2.0"', '"version":"0.1.0"')),
      target: 'linux-x64',
      tmpDir: () => tmp.path,
    }).installFromCatalog('gepard-ext-demo');
    expect(first.map((e) => e.version)).toEqual(['0.1.0']);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo-0.1.0']);

    const second = await installer.installFromCatalog('gepard-ext-demo');
    expect(second.map((e) => e.version)).toEqual(['0.2.0']);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo-0.2.0']);
  });
});

describe('parseChecksumFile', () => {
  const digest = 'a'.repeat(64);

  it('accepts bare digests and sha256sum lines naming the file', () => {
    expect(parseChecksumFile(`${digest}\n`, 'x.tar.gz')).toBe(digest);
    expect(parseChecksumFile(`${digest}  x.tar.gz\n`, 'x.tar.gz')).toBe(digest);
    expect(parseChecksumFile(`${digest} *./dir/x.tar.gz`, 'x.tar.gz')).toBe(digest);
    expect(
      parseChecksumFile(`${'B'.repeat(64)}  other.tar.gz\n${digest}  x.tar.gz`, 'x.tar.gz'),
    ).toBe(digest);
  });

  it('rejects files without a matching entry', () => {
    expect(() => parseChecksumFile(`${digest}  other.tar.gz`, 'x.tar.gz')).toThrow(
      /no sha256 entry/,
    );
    expect(() => parseChecksumFile('garbage', 'x.tar.gz')).toThrow();
  });
});

describe('findPackageRoot', () => {
  it('accepts a package.json at the root or in a single top-level directory', async () => {
    const tmp = await makeTmpDir('pkg-root');
    try {
      await mkdir(join(tmp.path, 'nested', 'pkg'), { recursive: true });
      await writeFile(join(tmp.path, 'nested', 'pkg', 'package.json'), '{}');
      expect(await findPackageRoot(join(tmp.path, 'nested'))).toBe(join(tmp.path, 'nested', 'pkg'));
      await writeFile(join(tmp.path, 'nested', 'package.json'), '{}');
      expect(await findPackageRoot(join(tmp.path, 'nested'))).toBe(join(tmp.path, 'nested'));
      await mkdir(join(tmp.path, 'empty'));
      await expect(findPackageRoot(join(tmp.path, 'empty'))).rejects.toMatchObject({
        code: 'EXTENSION_INVALID_ARCHIVE',
      });
    } finally {
      await tmp.cleanup();
    }
  });
});
