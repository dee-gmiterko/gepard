import { describe, expect, it } from 'vitest';
import { parseCli } from '../cli';

describe('parseCli', () => {
  it('reads the first positional argument as the launch target', () => {
    expect(parseCli(['https://github.com/o/r']).target).toBe('https://github.com/o/r');
    expect(parseCli(['o/r']).target).toBe('o/r');
    expect(parseCli(['123']).target).toBe('123');
  });

  it('skips Chromium and Electron switches, with or without values', () => {
    expect(parseCli(['--remote-debugging-port=9222', '--inspect=5858', 'o/r']).target).toBe('o/r');
    expect(parseCli(['--no-sandbox', 'o/r']).target).toBe('o/r');
    expect(parseCli(['--enable-logging', 'o/r']).target).toBe('o/r');
  });

  it('honours the `--` separator', () => {
    expect(parseCli(['--no-sandbox', '--', '-weird']).target).toBe('-weird');
    expect(parseCli(['--']).target).toBeNull();
  });

  it('returns null without a target', () => {
    expect(parseCli([]).target).toBeNull();
    expect(parseCli(['--no-sandbox']).target).toBeNull();
  });

  it('detects the window-shown report switch', () => {
    expect(parseCli(['o/r', '--report-window-shown'])).toEqual({
      target: 'o/r',
      reportWindowShown: true,
    });
    expect(parseCli(['o/r']).reportWindowShown).toBe(false);
  });
});
