export interface CommandLineSwitch {
  name: string;
  value?: string;
}

const WAYLAND_IME_OVERRIDES = ['--enable-wayland-ime', '--disable-wayland-ime'];

// Mutter only speaks text-input-v3; without Chromium's IME context it never raises the OSK.
export function onScreenKeyboardSwitches(
  platform: NodeJS.Platform,
  argv: readonly string[],
): CommandLineSwitch[] {
  if (platform !== 'linux') return [];
  if (argv.some((arg) => WAYLAND_IME_OVERRIDES.includes(arg))) return [];
  return [{ name: 'enable-wayland-ime' }, { name: 'wayland-text-input-version', value: '3' }];
}
