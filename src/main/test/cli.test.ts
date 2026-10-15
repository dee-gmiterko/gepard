import { describe, expect, it } from 'vitest';
import { parseCli } from '../cli';

describe('parseCli', () => {
  it('reads the positional argument as the launch target', () => {
    expect(parseCli(['https://github.com/o/r']).target).toBe('https://github.com/o/r');
    expect(parseCli(['o/r']).target).toBe('o/r');
    expect(parseCli(['123']).target).toBe('123');
  });

  it('ignores Chromium and Electron switches', () => {
    expect(parseCli(['--remote-debugging-port=9222', '--inspect=5858', 'o/r']).target).toBe('o/r');
    expect(parseCli(['--no-sandbox', 'o/r']).target).toBe('o/r');
  });

  it('returns null without a target', () => {
    expect(parseCli([]).target).toBeNull();
    expect(parseCli(['--no-sandbox']).target).toBeNull();
  });

  it('detects the window-shown report switch', () => {
    expect(parseCli(['o/r', '--report-window-shown'])).toEqual({
      target: 'o/r',
      reportWindowShown: true,
      server: null,
    });
    expect(parseCli(['o/r']).reportWindowShown).toBe(false);
  });

  it('parses --server host:port', () => {
    expect(parseCli(['--server', '127.0.0.1:8080'])).toEqual({
      target: null,
      reportWindowShown: false,
      server: { host: '127.0.0.1', port: 8080 },
    });
    expect(parseCli(['--server=localhost:3000', 'o/r'])).toMatchObject({
      target: 'o/r',
      server: { host: 'localhost', port: 3000 },
    });
  });

  it('leaves server null when --server is not passed', () => {
    expect(parseCli(['o/r']).server).toBeNull();
    expect(parseCli([]).server).toBeNull();
  });

  it('rejects --server without a value', () => {
    expect(() => parseCli(['--server'])).toThrow('--server expects host:port');
    expect(() => parseCli(['--server='])).toThrow('--server expects host:port');
  });

  it('rejects a malformed --server value', () => {
    const malformed = ['localhost', ':8080', 'localhost:', 'host:http', 'host:70000', 'host:0'];
    for (const value of malformed)
      expect(() => parseCli(['--server', value]), value).toThrow('--server expects host:port');
  });
});
