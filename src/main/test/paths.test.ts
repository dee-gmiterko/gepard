import { describe, expect, it } from 'vitest';
import { Paths, resolveUserDataDir } from '../paths';

describe('resolveUserDataDir', () => {
  it('follows the Electron userData location per platform', () => {
    expect(resolveUserDataDir('linux', {}, '/home/u')).toBe('/home/u/.config/gepard');
    expect(resolveUserDataDir('linux', { XDG_CONFIG_HOME: '/xdg' }, '/home/u')).toBe('/xdg/gepard');
    expect(resolveUserDataDir('darwin', {}, '/Users/u')).toBe(
      '/Users/u/Library/Application Support/gepard',
    );
    expect(resolveUserDataDir('win32', { APPDATA: 'C:\\A' }, 'C:\\h')).toMatch(/gepard$/);
  });
});

describe('Paths', () => {
  const paths = new Paths('/data', '/app/out', false);

  it('derives locations from the base directory it was constructed with', () => {
    expect(paths.settingsJsonPath()).toBe('/data/settings.json');
    expect(paths.projectRepoDir('o__r')).toBe('/data/projects/o__r/repo');
    expect(paths.logsDir()).toBe('/data/logs');
  });

  it('resolves built-in extensions relative to the app path', () => {
    expect(paths.builtinExtensionsDir()).toBe('/dist/extensions');
    expect(new Paths('/data', '/r/app.asar', true).builtinExtensionsDir()).toBe('/r/extensions');
  });

  it('rejects invalid project ids', () => {
    expect(() => paths.projectDir('../x')).toThrow();
  });
});
