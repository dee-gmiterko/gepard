import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionCatalog, type GitHubRelease, type GitHubReleaseSource } from '@gepard/common';
import { GhClient } from '../../clients/gh';
import type { run as execRun, runJson as execRunJson } from '../../helpers/process/exec';
import { ExtensionCatalogService } from '../../services/extensionCatalog';
import { ExtensionInstallerService } from '../../services/extensionInstaller';
import { DownloadService } from '../../services/download';
import { DEMO_LANG_BODY, writePackage } from '../support/extensionPackages';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';
import { KIND_SPECS } from '../../extensions/kindSpecs';
import { ExtensionScannerService } from '../../services/extensionScanner';
import { ExtensionsService } from '../../services/extensions';

const execFileAsync = promisify(execFile);

const CATALOG = ExtensionCatalog.parse([
  {
    name: 'gepard-ext-demo',
    repository: 'dee-gmiterko/gepard',
    path: 'extensions/lsp/demo',
    displayName: 'Demo',
    kind: 'lsp',
    description: 'demo',
    sha: 'a'.repeat(40),
  },
  {
    name: 'gepard-ext-native',
    repository: 'dee-gmiterko/gepard',
    path: 'extensions/lsp/native',
    displayName: 'Native',
    kind: 'lsp',
    description: 'native',
    platforms: ['linux-x64'],
    sha: 'b'.repeat(40),
  },
]);

const DEMO: GitHubReleaseSource = {
  kind: 'github-release',
  repository: 'dee-gmiterko/gepard',
  path: 'extensions/lsp/demo',
};

function fromRepo(repository: string, path: string | null): GitHubReleaseSource {
  return { kind: 'github-release', repository, path };
}

function release(tag: string, ...assets: string[]): GitHubRelease {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: assets.map((name) => ({ name })),
  };
}

class FakeGitHub {
  readonly assets = new Map<string, string>();
  readonly files = new Map<string, string>();
  releases: GitHubRelease[] = [];
  readonly downloads: string[] = [];
  readonly calls: string[][] = [];

  private readonly run: typeof execRun = async (_cmd, args) => {
    this.calls.push(args);
    return { stdout: await this.handle(args), stderr: '', exitCode: 0 };
  };

  private readonly runJson: typeof execRunJson = async (schema, cmd, args, opts) =>
    schema.parse(JSON.parse((await this.run(cmd, args, opts)).stdout));

  readonly client = new GhClient({ onRemoteResult: () => undefined }, this.run, this.runJson);

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

describe('ExtensionInstallerService', () => {
  let tmp: TmpDir;
  let extensions: ExtensionsService;
  let github: FakeGitHub;
  let installer: ExtensionInstallerService;
  let userExtensions: string;

  function makeInstaller(target = 'linux-x64'): ExtensionInstallerService {
    return new ExtensionInstallerService(
      extensions,
      new ExtensionCatalogService(CATALOG, extensions, target),
      github.client,
      new DownloadService(github.client, () => tmp.path),
      target,
    );
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
    userExtensions = join(userData, 'extensions');
    const builtins = join(tmp.path, 'builtins');
    await mkdir(builtins, { recursive: true });
    extensions = new ExtensionsService(
      () => userExtensions,
      new ExtensionScannerService(
        () => userExtensions,
        () => builtins,
        KIND_SPECS,
      ),
    );
    github = new FakeGitHub();
    installer = makeInstaller();
  });

  afterEach(async () => {
    await tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('installs the latest release of a catalog entry without reading its package.json', async () => {
    const older = await buildRelease('gepard-ext-demo', '0.1.0', null);
    const newer = await buildRelease('gepard-ext-demo', '0.2.0', null);
    github.releases = [
      release('gepard-ext-demo-v0.2.0', newer),
      release('gepard-ext-demo-v0.1.0', older),
    ];

    const list = await installer.install(DEMO);

    expect(github.calls).toHaveLength(2);
    expect(github.calls[0]).toEqual(['api', 'repos/dee-gmiterko/gepard/releases?per_page=100']);
    expect(github.calls[1]).toEqual([
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
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo']);
    expect(await readdir(tmp.path)).not.toContain(expect.stringMatching(/^gepard-ext-/));
  });

  it('downloads the platform tarball of a platform-specific entry', async () => {
    const native = fromRepo('dee-gmiterko/gepard', 'extensions/lsp/native');
    const asset = await buildRelease('gepard-ext-native', '1.0.0', 'linux-x64');
    github.releases = [release('gepard-ext-native-v1.0.0', asset)];
    await installer.install(native);
    expect(github.downloads[0]).toBe(
      'gepard-ext-native-v1.0.0/gepard-ext-native-1.0.0-linux-x64.tgz',
    );

    await expect(makeInstaller('win32-arm64').install(native)).rejects.toMatchObject({
      code: 'EXTENSION_UNSUPPORTED_PLATFORM',
    });
  });

  it('refuses an archive that contains a different package than requested', async () => {
    const asset = await buildRelease('gepard-ext-other', '0.2.0', null, {
      tag: 'gepard-ext-demo-v0.2.0',
    });
    github.releases = [release('gepard-ext-demo-v0.2.0', asset)];
    await expect(installer.install(DEMO)).rejects.toMatchObject({
      code: 'EXTENSION_INVALID_PACKAGE',
    });
    expect(await extensions.list()).toEqual([]);
  });

  describe('from a repository outside the catalog', () => {
    it('installs the latest release asset for the current platform', async () => {
      const older = await buildRelease('gepard-ext-demo', '0.1.0', 'linux-x64');
      const newer = await buildRelease('gepard-ext-demo', '0.2.0', 'linux-x64');
      const foreign = await buildRelease('gepard-ext-demo', '0.2.0', 'darwin-arm64');
      github.releases = [
        { tag_name: 'gepard-ext-demo-v0.3.0', draft: true, prerelease: false, assets: [] },
        release('v9.0.0', 'gepard-9.0.0.AppImage'),
        release('gepard-ext-demo-v0.2.0', foreign, newer),
        release('gepard-ext-demo-v0.1.0', older),
      ];

      const list = await installer.install(fromRepo('https://github.com/other/ext', ''));
      expect(list.map((e) => e.version)).toEqual(['0.2.0']);
      expect(github.calls[0]).toEqual(['api', 'repos/other/ext/releases?per_page=100']);
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
        release('gepard-ext-demo-v0.2.0', demo),
        release('gepard-ext-other-v0.5.0', other),
      ];

      const list = await installer.install(fromRepo('other/ext', '/extensions/lsp/other/'));
      expect(github.calls[0]).toEqual([
        'api',
        '-H',
        'Accept: application/vnd.github.raw+json',
        'repos/other/ext/contents/extensions/lsp/other/package.json',
      ]);
      expect(list).toEqual([
        expect.objectContaining({ packageName: 'gepard-ext-other', version: '0.5.0' }),
      ]);
      expect(await readdir(userExtensions)).toEqual(['gepard-ext-other']);
    });

    it('reports a missing package.json, a missing release and bad input', async () => {
      await expect(installer.install(fromRepo('other/ext', 'nowhere'))).rejects.toMatchObject({
        code: 'EXTENSION_INVALID_PACKAGE',
      });
      github.releases = [release('v1.0.0')];
      await expect(installer.install(fromRepo('other/ext', null))).rejects.toMatchObject({
        code: 'EXTENSION_RELEASE_NOT_FOUND',
      });
      await expect(installer.install(fromRepo('not a repo', null))).rejects.toMatchObject({
        code: 'BAD_INPUT',
      });
    });
  });

  it('updates in place: the old version is replaced by the new one', async () => {
    const first = await buildRelease('gepard-ext-demo', '0.1.0', null);
    const second = await buildRelease('gepard-ext-demo', '0.2.0', null);
    github.releases = [release('gepard-ext-demo-v0.1.0', first)];
    expect((await installer.install(DEMO)).map((e) => e.version)).toEqual(['0.1.0']);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo']);

    github.releases = [release('gepard-ext-demo-v0.2.0', second)];
    expect((await installer.install(DEMO)).map((e) => e.version)).toEqual(['0.2.0']);
    expect(await readdir(userExtensions)).toEqual(['gepard-ext-demo']);
  });
});
