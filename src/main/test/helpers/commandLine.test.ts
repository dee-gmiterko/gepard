import { describe, expect, it } from 'vitest';
import { hasSwitch, switchOverrides } from '../../helpers/commandLine';

describe('hasSwitch', () => {
  it('matches a bare switch and one with a value', () => {
    expect(hasSwitch(['gepard', '--enable-wayland-ime'], 'enable-wayland-ime')).toBe(true);
    expect(hasSwitch(['gepard', '--gtk-version=4'], 'gtk-version')).toBe(true);
  });

  it('ignores other switches and positional arguments', () => {
    expect(hasSwitch(['gepard', '--gtk-version-x=4'], 'gtk-version')).toBe(false);
    expect(hasSwitch(['gepard', 'gtk-version'], 'gtk-version')).toBe(false);
    expect(hasSwitch([], 'gtk-version')).toBe(false);
  });
});

describe('switchOverrides', () => {
  const overrides = [
    { switches: [{ name: 'gtk-version', value: '3' }] },
    {
      switches: [
        { name: 'enable-wayland-ime' },
        { name: 'wayland-text-input-version', value: '3' },
      ],
      unlessGiven: ['enable-wayland-ime', 'disable-wayland-ime'],
    },
  ];

  it('flattens every override when nothing on the command line overrides it', () => {
    expect(switchOverrides(['gepard'], overrides)).toEqual([
      { name: 'gtk-version', value: '3' },
      { name: 'enable-wayland-ime' },
      { name: 'wayland-text-input-version', value: '3' },
    ]);
  });

  it('drops only the override whose switch was given on the command line', () => {
    expect(switchOverrides(['gepard', '--disable-wayland-ime'], overrides)).toEqual([
      { name: 'gtk-version', value: '3' },
    ]);
    expect(switchOverrides(['gepard', '--enable-wayland-ime'], overrides)).toEqual([
      { name: 'gtk-version', value: '3' },
    ]);
  });
});
