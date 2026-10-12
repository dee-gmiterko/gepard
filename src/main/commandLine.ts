import { app } from 'electron';
import {
  switchOverrides,
  type CommandLineSwitch,
  type SwitchOverride,
} from './helpers/commandLine';

const LINUX_OVERRIDES: SwitchOverride[] = [
  // Electron >= 36 on GNOME 48+/Fedora aborts at startup with a GTK 2/3 vs 4
  // symbol clash unless launched with --gtk-version=3.
  { switches: [{ name: 'gtk-version', value: '3' }] },
  // Mutter only speaks text-input-v3; without Chromium's IME context it never raises the OSK.
  // With GTK loaded Chromium prefers its GTK IM context over the Wayland one, so GTK IME is disabled.
  {
    switches: [
      { name: 'enable-wayland-ime' },
      { name: 'wayland-text-input-version', value: '3' },
      { name: 'disable-gtk-ime' },
    ],
    unlessGiven: ['enable-wayland-ime', 'disable-wayland-ime'],
  },
];

export function commandLineSwitches(
  platform: NodeJS.Platform,
  argv: readonly string[],
): CommandLineSwitch[] {
  return platform === 'linux' ? switchOverrides(argv, LINUX_OVERRIDES) : [];
}

export function applyCommandLineSwitches(): void {
  for (const { name, value } of commandLineSwitches(process.platform, process.argv)) {
    app.commandLine.appendSwitch(name, value);
  }
}
