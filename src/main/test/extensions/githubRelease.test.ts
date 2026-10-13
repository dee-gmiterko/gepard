import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionCatalog, type GitHubReleaseSource } from '@gepard/common';
import { GhClient, type GhExec } from '../../clients/gh';
import { ExtensionRegistry } from '../../extensions/registry';
import {
  ExtensionInstaller,
  findPackageRoot,
  type GitHubRelease,
} from '../../extensions/githubRelease';
import { DEMO_LANG_BODY, writePackage } from '../support/extensionPackages';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const execFileAsync = promisify(execFile);

const CATALOG = ExtensionCatalog.parse({
  schemaVersion: 1,
  repository: 'dee-gmiterko/gepard',
  extensions: {
    'gepard-ext-demo': {
      displayName: 'Demo',
      kind: 'lsp',
      description: 'demo',
      path: 'extensions/lsp/demo',
      version: '0.2.0',
      sha: 'a'.repeat(40),
    },
    'gepard-ext-native': {
      displayName: 'Native',
      kind: 'lsp',
      description: 'native',
      path: 'extensions/lsp/native',
      version: '1.0.0',
      platforms: ['linux-x64'],
      sha: 'b'.repeat(40),
    },
  },
});

const DEMO: GitHubReleaseSource = {
  kind: 'github-release',
  repository: 'dee-gmiterko/gepard',
  path: 'extensions/lsp/demo',
};

function fromRepo(repository: string, path: string | null): GitHubReleaseSource {
  return { kind: 'github-release', repository, path };
}

class FakeGitHub {
  readonly assets = new Map<string, string>();
  readonly files = new Map<string, string>();
  releases: GitHubRelease[] = [];
  readonly downloads: string[] = [];
  readonly calls: string[][] = [];

  readonly client = new GhClient({ onRemoteResult: () => undefined }, this.exec());

  private exec(): GhExec {
    const run: GhExec['run'] = async (_cmd, args) => {
      this.calls.push(args);
      return { stdout: await this.handle(args), stderr: '', exitCode: 0 };
    };
    const runJson: GhExec['runJson'] = async (schema, cmd, args, opts) =>
      schema.parse(JSON.parse((await run(cmd, args, opts)).stdout));
    return { run, runJson };
  }

  private async handle(args: string[]): Promise<string> {
    if (args[0] === 'api' && args[1].endsWith('/releases?per_page=100')) {
      return JSON.stringify(this.releases);
    }
    if (args[0] === 'api' && args[1] === '-H') {
      const filePath = args[3].replace(/^repos\/[^/]+\/[^/]+\/contents\//, '');
      const text = this.files.get(filePath);
      if (text === undefined) throw new Error(`404 ${filePath}`);
      return text;
    }
    if (args[0] === 'release' && args[1] === 'download') {
      const tag = args[2];
      const assetName = args[args.indexOf('--pattern') + 1];
      const destDir = args[args.indexOf('--dir') + 1];
      this.downloads.push(`${tag}/${assetName}`);
      const file = this.assets.get(`${tag}/${assetName}`);
      if (!file) throw new Error(`no asset ${tag}/${assetName}`);
      await copyFile(file, join(destDir, assetName));
      return '';
    }
    throw new Error(`unexpected gh ${args.join(' ')}`);
  }
}

describe('ExtensionInstaller', () => {
  let tmp: TmpDir;
  let registry: ExtensionRegistry;
  let github: FakeGitHub;
  let installer: ExtensionInstaller;
  let userExtensions: string;

  function makeInstaller(
    options: { target?: string; catalog?: ExtensionCatalog } = {},
  ): ExtensionInstaller {
    return new ExtensionInstaller({
      registry,
      client: github.client,
      catalog: options.catalog ?? CATALOG,
      target: options.target ?? 'linux-x64',
      tmpDir: () => tmp.path,
    });
  }

  // Lays the package out like npm pack does: a single package/ directory in the tarball.
  async function buildRelease(
    name: string,
    version: string,
    platform: string | null,
    options: { id?: string; tag?: string } = {},
  ): Promise<string> {
    const stage = join(tmp.path, 'stage', `${name}-${version}-${platform ?? 'any'}`);
    await mkdir(stage, { recursive: true });
    const id = options.id ?? name.replace(/^gepard-ext-/, '');
    await writePackage(stage, 'package', DEMO_LANG_BODY.replace('demo-lang', id), {
      name,
      version,
    });
    const tag = options.tag ?? `${name}-v${version}`;
    const assetName = `${name}-${version}${platform ? `-${platform}` : ''}.tgz`;
    const archive = join(tmp.path, 'releases', `${tag}--${assetName}`);
    await mkdir(join(tmp.path, 'releases'), { recursive: true });
    await execFileAsync('tar', ['-czf', archive, '-C', stage, 'package']);
    github.assets.set(`${tag}/${assetName}`, archive);
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
    github = new FakeGitHub();
    installer = makeInstaller();
  });

  afterEach(async () => {
    await tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('installs a catalog entry at its pinned version', async () => {
    await buildRelease('gepard-ext-demo', '0.2.0', null);

    const list = await installer.install(DEMO);

    expect(github.downloads).toEqual(['gepard-ext-demo-v0.2.0/gepard-ext-demo-0.2.0.tgz']);
    expect(github.calls[0]).toEqual([
      'release',
      'download',
      'gepard-ext-demo-v0.2.0',
      '--repo',
      'dee-gmiterko/gepard',
      '--pattern',
      'gepard-ext-demo-0.2.0.tgz',
      '--dir',
      expect.stringContaining(join(tmp.path, 'gepard-ext-')),
      '--clobber',
    ]);
    expect(list).toEqual([
      expect.objectContaining({
        id: 'demo',
        packageName: 'gepard-ext-demo',
        version: '0.2.0',
        source: { kind: 'local' },
        enabled: true,
      }),
    ]);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo-0.2.0']);
    expect(await readdir(tmp.path)).not.toContain(expect.stringMatching(/^gepard-ext-/));
  });

  it('downloads the platform tarball of a platform-specific entry', async () => {
    const native = fromRepo('dee-gmiterko/gepard', 'extensions/lsp/native');
    await buildRelease('gepard-ext-native', '1.0.0', 'linux-x64');
    await installer.install(native);
    expect(github.downloads[0]).toBe(
      'gepard-ext-native-v1.0.0/gepard-ext-native-1.0.0-linux-x64.tgz',
    );

    await expect(makeInstaller({ target: 'win32-arm64' }).install(native)).rejects.toMatchObject({
      code: 'EXTENSION_UNSUPPORTED_PLATFORM',
    });
  });

  it('refuses an archive that contains a different package than requested', async () => {
    await buildRelease('gepard-ext-other', '0.2.0', null, { tag: 'gepard-ext-demo-v0.2.0' });
    github.assets.set(
      'gepard-ext-demo-v0.2.0/gepard-ext-demo-0.2.0.tgz',
      join(tmp.path, 'releases', 'gepard-ext-demo-v0.2.0--gepard-ext-other-0.2.0.tgz'),
    );
    await expect(installer.install(DEMO)).rejects.toMatchObject({
      code: 'EXTENSION_INVALID_PACKAGE',
    });
    expect(await registry.list()).toEqual([]);
  });

  describe('from a repository outside the catalog', () => {
    it('installs the latest release asset for the current platform', async () => {
      const older = await buildRelease('gepard-ext-demo', '0.1.0', 'linux-x64');
      const newer = await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');
      const foreign = await buildRelease('gepard-ext-demo', '0.2.0', 'darwin-arm64');
      github.releases = [
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
          assets: [{ name: foreign }, { name: newer }],
        },
        {
          tag_name: 'gepard-ext-demo-v0.1.0',
          draft: false,
          prerelease: false,
          assets: [{ name: older }],
        },
      ];

      const list = await installer.install(fromRepo('https://github.com/dee-gmiterko/gepard', ''));
      expect(list.map((e) => e.version)).toEqual(['0.2.0']);
      expect(github.calls[0]).toEqual(['api', 'repos/dee-gmiterko/gepard/releases?per_page=100']);
      expect(github.downloads[0]).toBe(`gepard-ext-demo-v0.2.0/${newer}`);
    });

    it('uses the package at the given path to pick the matching component release', async () => {
      const demo = await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');
      const other = await buildRelease('gepard-ext-other', '0.5.0', null);
      github.files.set(
        'extensions/lsp/other/package.json',
        JSON.stringify({ name: 'gepard-ext-other' }),
      );
      github.releases = [
        {
          tag_name: 'gepard-ext-demo-v0.2.0',
          draft: false,
          prerelease: false,
          assets: [{ name: demo }],
        },
        {
          tag_name: 'gepard-ext-other-v0.5.0',
          draft: false,
          prerelease: false,
          assets: [{ name: other }],
        },
      ];

      const list = await installer.install(
        fromRepo('dee-gmiterko/gepard', '/extensions/lsp/other/'),
      );
      expect(github.calls[0]).toEqual([
        'api',
        '-H',
        'Accept: application/vnd.github.raw+json',
        'repos/dee-gmiterko/gepard/contents/extensions/lsp/other/package.json',
      ]);
      expect(list).toEqual([
        expect.objectContaining({ packageName: 'gepard-ext-other', version: '0.5.0' }),
      ]);
      expect(await readdir(userExtensions)).toEqual(['gepard-ext-other-0.5.0']);
    });

    it('reports a missing package.json, a missing release and bad input', async () => {
      await expect(
        installer.install(fromRepo('dee-gmiterko/gepard', 'nowhere')),
      ).rejects.toMatchObject({ code: 'EXTENSION_INVALID_PACKAGE' });
      github.releases = [{ tag_name: 'v1.0.0', draft: false, prerelease: false, assets: [] }];
      await expect(installer.install(fromRepo('dee-gmiterko/gepard', null))).rejects.toMatchObject({
        code: 'EXTENSION_RELEASE_NOT_FOUND',
      });
      await expect(installer.install(fromRepo('not a repo', null))).rejects.toMatchObject({
        code: 'BAD_INPUT',
      });
    });
  });

  it('updates in place: the old version directory is removed and the new one listed', async () => {
    await buildRelease('gepard-ext-demo', '0.1.0', null);
    await buildRelease('gepard-ext-demo', '0.2.0', null);
    const olderCatalog = ExtensionCatalog.parse({
      ...CATALOG,
      extensions: {
        ...CATALOG.extensions,
        'gepard-ext-demo': { ...CATALOG.extensions['gepard-ext-demo'], version: '0.1.0' },
      },
    });
    const first = await makeInstaller({ catalog: olderCatalog }).install(DEMO);
    expect(first.map((e) => e.version)).toEqual(['0.1.0']);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo-0.1.0']);

    const second = await installer.install(DEMO);
    expect(second.map((e) => e.version)).toEqual(['0.2.0']);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo-0.2.0']);
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
