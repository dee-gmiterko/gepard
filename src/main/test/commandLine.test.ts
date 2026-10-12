import { describe, expect, it } from 'vitest';
import { commandLineSwitches } from '../commandLine';

describe('commandLineSwitches', () => {
  it('forces GTK 3 and the Wayland text-input-v3 IME on Linux', () => {
    expect(commandLineSwitches('linux', ['/usr/bin/gepard'])).toEqual([
      { name: 'gtk-version', value: '3' },
      { name: 'enable-wayland-ime' },
      { name: 'wayland-text-input-version', value: '3' },
    ]);
  });

  it('leaves an explicit Wayland IME switch on the command line alone', () => {
    expect(commandLineSwitches('linux', ['gepard', '--disable-wayland-ime'])).toEqual([
      { name: 'gtk-version', value: '3' },
    ]);
    expect(commandLineSwitches('linux', ['gepard', '--enable-wayland-ime'])).toEqual([
      { name: 'gtk-version', value: '3' },
    ]);
  });

  it('adds nothing on Windows and macOS', () => {
    expect(commandLineSwitches('win32', [])).toEqual([]);
    expect(commandLineSwitches('darwin', [])).toEqual([]);
  });
});
