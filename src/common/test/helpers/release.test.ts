import { describe, expect, it } from 'vitest';
import { GitHubRelease, pickReleaseAsset, releaseTagPrefix } from '../../helpers/release';

describe('releaseTagPrefix', () => {
  it('prefixes the tags of one package', () => {
    expect(releaseTagPrefix('gepard-ext-csharp')).toBe('gepard-ext-csharp-v');
  });
});

describe('pickReleaseAsset', () => {
  it('prefers the exact platform, then the platform-independent tarball', () => {
    const assets = [
      'gepard-ext-x-1.0.0.tgz',
      'gepard-ext-x-1.0.0-linux-x64.tgz',
      'gepard-ext-x-1.0.0-linux-x64.tgz.sha256',
      'notes.txt',
    ];
    expect(pickReleaseAsset(assets, 'linux-x64')).toBe('gepard-ext-x-1.0.0-linux-x64.tgz');
    expect(pickReleaseAsset(assets, 'win32-arm64')).toBe('gepard-ext-x-1.0.0.tgz');
    expect(pickReleaseAsset(['gepard-ext-x-1.0.0-darwin-x64.tgz'], 'linux-x64')).toBeNull();
    expect(pickReleaseAsset(['gepard-ext-x-1.0.0-rc-1.tgz'], 'linux-x64')).toBe(
      'gepard-ext-x-1.0.0-rc-1.tgz',
    );
  });
});

describe('GitHubRelease', () => {
  it('defaults the flags and assets and rejects a release without a tag', () => {
    expect(GitHubRelease.parse({ tag_name: 'x-v1.0.0' })).toEqual({
      tag_name: 'x-v1.0.0',
      draft: false,
      prerelease: false,
      assets: [],
    });
    expect(() => GitHubRelease.parse({ draft: true })).toThrow();
  });
});
