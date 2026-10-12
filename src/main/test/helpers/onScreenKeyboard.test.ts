import { describe, expect, it } from 'vitest';
import { onScreenKeyboardSwitches } from '../../helpers/onScreenKeyboard';

describe('onScreenKeyboardSwitches', () => {
  it('enables the Wayland text-input-v3 IME on Linux', () => {
    expect(onScreenKeyboardSwitches('linux', ['/usr/bin/gepard'])).toEqual([
      { name: 'enable-wayland-ime' },
      { name: 'wayland-text-input-version', value: '3' },
    ]);
  });

  it('leaves an explicit Wayland IME switch on the command line alone', () => {
    expect(onScreenKeyboardSwitches('linux', ['gepard', '--disable-wayland-ime'])).toEqual([]);
    expect(onScreenKeyboardSwitches('linux', ['gepard', '--enable-wayland-ime'])).toEqual([]);
  });

  it('adds nothing on Windows and macOS', () => {
    expect(onScreenKeyboardSwitches('win32', [])).toEqual([]);
    expect(onScreenKeyboardSwitches('darwin', [])).toEqual([]);
  });
});
